import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import {
  buildMvpReport,
  formatMvpReport,
  type AuthenticityLabel,
  type ConditionLabel,
  type Marketplace,
  type NotificationChannel,
  type Recommendation,
  type RiskGroup
} from './index.js'
import { renderDashboardHtml } from './dashboard.js'
import { createArtifactStore } from './artifacts.js'
import {
  listAlexFeedback,
  loadLatestLiveScan,
  recordAlexFeedback,
  runLiveScan
} from './live.js'
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
  storageBucket?: string
  alexWebhookUrl?: string
  liveWatchlistLimit?: number
  liveQueryStrategy?: 'primary' | 'all'
  liveLimitPerQuery?: number
  liveSearchConcurrency?: number
  liveFetchTimeoutMs?: number
  liveMaxNotifications?: number
  liveMaxReviews?: number
  sentimentPath?: string
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
    apiKey: process.env.ARB_API_KEY?.trim() || undefined,
    storageBucket: process.env.ARB_STORAGE_BUCKET?.trim() || process.env.ARB_EVIDENCE_BUCKET?.trim() || undefined,
    alexWebhookUrl: process.env.ARB_ALEX_WEBHOOK_URL?.trim() || undefined,
    liveWatchlistLimit: parseOptionalInt(process.env.ARB_LIVE_WATCHLIST_LIMIT),
    liveQueryStrategy:
      process.env.ARB_QUERY_STRATEGY?.trim() === 'primary' ? 'primary' : 'all',
    liveLimitPerQuery: parseOptionalInt(process.env.ARB_LIMIT_PER_QUERY),
    liveSearchConcurrency: parseOptionalInt(process.env.ARB_SEARCH_CONCURRENCY),
    liveFetchTimeoutMs: parseOptionalInt(process.env.ARB_FETCH_TIMEOUT_MS),
    liveMaxNotifications: parseOptionalInt(process.env.ARB_MAX_NOTIFICATIONS),
    liveMaxReviews: parseOptionalInt(process.env.ARB_MAX_REVIEWS),
    sentimentPath: process.env.ARB_SENTIMENT_PATH?.trim() || undefined
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
  if (requestKey === apiKey) {
    return true
  }

  return false
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

function sendHtml(response: ServerResponse, statusCode: number, payload: string): void {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(payload)
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) {
    throw new Error('Missing request body')
  }

  return JSON.parse(raw) as T
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
  const artifactStore = createArtifactStore(config.storageBucket)
  const isPublicRoute =
    request.method === 'GET' && (route === '/dashboard' || route === '/dashboard/')

  if (!isPublicRoute && !hasValidApiKey(request, config.apiKey)) {
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
      endpoints: [
        '/dashboard',
        '/healthz',
        '/summary',
        '/notify',
        '/review',
        '/live/latest',
        '/live/inbox',
        '/live/alerts.txt',
        '/live/feedback',
        '/live/scan'
      ]
    })
    return
  }

  if (request.method === 'GET' && (route === '/dashboard' || route === '/dashboard/')) {
    sendHtml(response, 200, renderDashboardHtml())
    return
  }

  if (request.method === 'GET' && route === '/favicon.ico') {
    response.writeHead(204, {
      'cache-control': 'no-store'
    })
    response.end()
    return
  }

  if (request.method === 'GET' && route === '/summary') {
    const summary = await buildSummaryResponse(config)
    sendJson(response, 200, summary)
    return
  }

  if (request.method === 'GET' && route === '/live/latest') {
    const latest = await loadLatestLiveScan(artifactStore)
    if (!latest) {
      sendJson(response, 200, {
        ok: false,
        error: 'No live scan found',
        latest: null
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      latest
    })
    return
  }

  if (request.method === 'GET' && route === '/live/inbox') {
    const latest = await loadLatestLiveScan(artifactStore)
    if (!latest) {
      sendJson(response, 200, {
        ok: false,
        error: 'No live scan found',
        generatedAt: null,
        scanId: null,
        notifications: [],
        reviews: [],
        sourceSummaries: [],
        unavailableSources: [],
        digest: ''
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      generatedAt: latest.generatedAt,
      scanId: latest.scanId,
      notifications: latest.notifications,
      reviews: latest.reviews,
      sourceSummaries: latest.sourceSummaries,
      unavailableSources: latest.unavailableSources,
      digest: latest.alexDigest
    })
    return
  }

  if (request.method === 'GET' && route === '/live/alerts.txt') {
    const latest = await loadLatestLiveScan(artifactStore)
    if (!latest) {
      sendText(response, 200, 'No live scan found')
      return
    }

    sendText(response, 200, latest.alexDigest)
    return
  }

  if (request.method === 'GET' && route === '/live/feedback') {
    const feedback = await listAlexFeedback(artifactStore)
    sendJson(response, 200, {
      ok: true,
      count: feedback.length,
      feedback
    })
    return
  }

  if (request.method === 'POST' && route === '/live/feedback') {
    const body = await readJsonBody<{
      listingId: string
      marketplace: string
      riskGroup: string
      authenticity: string
      condition: string
      recommendedAction?: string
      realizedProfitJpy?: number
      confidence?: number
      notes?: string
      sourceUrl?: string
      sourceListingId?: string
      sourceQuery?: string
      reviewer?: string
      reviewedAt?: string
      followUp?: string
    }>(request)

    const saved = await recordAlexFeedback(
      {
        listingId: body.listingId,
        marketplace: body.marketplace as Marketplace,
        riskGroup: body.riskGroup as RiskGroup,
        authenticity: body.authenticity as AuthenticityLabel,
        condition: body.condition as ConditionLabel,
        recommendedAction: body.recommendedAction as Recommendation,
        realizedProfitJpy: body.realizedProfitJpy,
        confidence: body.confidence,
        notes: body.notes,
        sourceUrl: body.sourceUrl,
        sourceListingId: body.sourceListingId,
        sourceQuery: body.sourceQuery,
        reviewer: body.reviewer,
        reviewedAt: body.reviewedAt,
        followUp: body.followUp
      },
      artifactStore
    )

    sendJson(response, 200, {
      ok: true,
      feedback: saved
    })
    return
  }

  if (request.method === 'POST' && route === '/live/scan') {
    const scan = await runLiveScan({
      watchlistLimit: config.liveWatchlistLimit,
      queryStrategy: config.liveQueryStrategy,
      limitPerQuery: config.liveLimitPerQuery,
      searchConcurrency: config.liveSearchConcurrency,
      fetchTimeoutMs: config.liveFetchTimeoutMs,
      maxNotifications: config.liveMaxNotifications,
      maxReviews: config.liveMaxReviews,
      sentimentPath: config.sentimentPath,
      notificationChannel: config.channel,
      artifactStore,
      alexWebhookUrl: config.alexWebhookUrl,
      notifyAlex: false
    })

    sendJson(response, 200, {
      ok: true,
      scan
    })
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
    routes: [
      '/dashboard',
      '/healthz',
      '/summary',
      '/notify',
      '/review',
      '/summary.txt',
      '/live/latest',
      '/live/inbox',
      '/live/alerts.txt',
      '/live/feedback',
      '/live/scan'
    ]
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
