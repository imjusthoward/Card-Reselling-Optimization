import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import {
  buildMvpReport,
  formatMvpReport,
  type NotificationChannel
} from './index.js'
import {
  buildWorkflowOutputs,
  loadWorkflow,
  resolveWorkflowPath,
  DEFAULT_CONFIG_PATH,
  DEFAULT_LABELS_PATH,
  DEFAULT_LISTINGS_PATH
} from './workflow.js'

interface RuntimeConfig {
  listingsPath: string
  labelsPath?: string
  configPath?: string
  limit?: number
  channel: NotificationChannel
  apiKey?: string
}

interface RuntimeSummary {
  service: string
  project: string
  region: string
  generatedAt: string
  inputs: {
    listingsPath: string
    labelsPath?: string
    configPath?: string
    limit?: number
    channel: NotificationChannel
  }
  report: ReturnType<typeof buildMvpReport>
  formattedReport: string
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseChannel(value: string | undefined): NotificationChannel {
  const candidate = value?.trim()
  switch (candidate) {
    case 'dashboard':
    case 'whatsapp':
    case 'sms':
    case 'telegram':
    case 'discord':
    case 'email':
      return candidate as NotificationChannel
    default:
      return 'dashboard'
  }
}

function getRuntimeConfig(): RuntimeConfig {
  return {
    listingsPath: resolveWorkflowPath(
      process.env.ARB_LISTINGS_PATH,
      DEFAULT_LISTINGS_PATH
    ),
    labelsPath:
      process.env.ARB_LABELS_PATH == null
        ? DEFAULT_LABELS_PATH
        : resolveWorkflowPath(process.env.ARB_LABELS_PATH, DEFAULT_LABELS_PATH),
    configPath:
      process.env.ARB_CONFIG_PATH == null
        ? DEFAULT_CONFIG_PATH
        : resolveWorkflowPath(process.env.ARB_CONFIG_PATH, DEFAULT_CONFIG_PATH),
    limit: parseOptionalInt(process.env.ARB_LIMIT),
    channel: parseChannel(process.env.ARB_CHANNEL),
    apiKey: process.env.ARB_API_KEY?.trim() || undefined
  }
}

function readHeader(header: string | string[] | undefined): string | undefined {
  if (Array.isArray(header)) {
    return header[0]
  }

  return header
}

function hasValidApiKey(request: IncomingMessage, apiKey?: string): boolean {
  if (!apiKey) {
    return true
  }

  const authorization = readHeader(request.headers.authorization)
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length) === apiKey
  }

  const requestKey = readHeader(request.headers['x-api-key'])
  return requestKey === apiKey
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(`${JSON.stringify(payload, null, 2)}\n`)
}

function sendText(response: ServerResponse, statusCode: number, payload: string): void {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(`${payload}\n`)
}

async function buildSummaryResponse(config: RuntimeConfig): Promise<RuntimeSummary> {
  const workflow = await loadWorkflow({
    listingsPath: config.listingsPath,
    labelsPath: config.labelsPath,
    configPath: config.configPath,
    limit: config.limit
  })

  return {
    service: 'arb-api',
    project: process.env.GOOGLE_CLOUD_PROJECT ?? 'japan-tcg-arb-260409',
    region: process.env.GCP_REGION ?? 'asia-northeast1',
    generatedAt: new Date().toISOString(),
    inputs: {
      listingsPath: config.listingsPath,
      labelsPath: config.labelsPath,
      configPath: config.configPath,
      limit: config.limit,
      channel: config.channel
    },
    report: workflow.report,
    formattedReport: formatMvpReport(workflow.report)
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const config = getRuntimeConfig()
  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const route = requestUrl.pathname

  if (!hasValidApiKey(request, config.apiKey)) {
    sendJson(response, 401, {
      ok: false,
      error: 'Unauthorized'
    })
    return
  }

  if (request.method === 'GET' && route === '/healthz') {
    sendJson(response, 200, {
      ok: true,
      service: 'arb-api',
      project: process.env.GOOGLE_CLOUD_PROJECT ?? 'japan-tcg-arb-260409',
      region: process.env.GCP_REGION ?? 'asia-northeast1',
      timestamp: new Date().toISOString()
    })
    return
  }

  if (request.method === 'GET' && route === '/') {
    sendJson(response, 200, {
      ok: true,
      service: 'arb-api',
      endpoints: ['/healthz', '/summary', '/notify', '/review']
    })
    return
  }

  if (request.method === 'GET' && route === '/summary') {
    const summary = await buildSummaryResponse(config)
    sendJson(response, 200, summary)
    return
  }

  if (request.method === 'GET' && route === '/notify') {
    const workflow = await loadWorkflow({
      listingsPath: config.listingsPath,
      labelsPath: config.labelsPath,
      configPath: config.configPath,
      limit: config.limit
    })
    const { notifications } = buildWorkflowOutputs(workflow.scores, config.channel)
    sendJson(response, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      channel: config.channel,
      count: notifications.length,
      notifications
    })
    return
  }

  if (request.method === 'GET' && route === '/review') {
    const workflow = await loadWorkflow({
      listingsPath: config.listingsPath,
      labelsPath: config.labelsPath,
      configPath: config.configPath,
      limit: config.limit
    })
    const { reviews } = buildWorkflowOutputs(workflow.scores, config.channel)
    sendJson(response, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      count: reviews.length,
      reviews
    })
    return
  }

  if (request.method === 'GET' && route === '/summary.txt') {
    const summary = await buildSummaryResponse(config)
    sendText(response, 200, summary.formattedReport)
    return
  }

  sendJson(response, 404, {
    ok: false,
    error: 'Not found',
    routes: ['/healthz', '/summary', '/notify', '/review', '/summary.txt']
  })
}

const port = parseOptionalInt(process.env.PORT) ?? 8080

createServer((request, response) => {
  void handleRequest(request, response).catch(error => {
    sendJson(response, 500, {
      ok: false,
      error: (error as Error).message
    })
  })
}).listen(port, () => {
  process.stdout.write(`arb-api listening on ${port}\n`)
})
