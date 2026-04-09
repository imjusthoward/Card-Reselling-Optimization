import { formatMvpReport, type NotificationChannel } from './index.js'
import { buildWorkflowOutputs, loadWorkflow, resolveWorkflowPath, DEFAULT_CONFIG_PATH, DEFAULT_LABELS_PATH, DEFAULT_LISTINGS_PATH } from './workflow.js'

interface JobConfig {
  listingsPath: string
  labelsPath?: string
  configPath?: string
  limit?: number
  channel: NotificationChannel
  output: 'summary' | 'notify' | 'review' | 'bundle'
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseChannel(value: string | undefined): NotificationChannel {
  const channel = value?.trim()

  switch (channel) {
    case 'whatsapp':
    case 'sms':
    case 'telegram':
    case 'discord':
    case 'email':
      return channel as NotificationChannel
    default:
      return 'dashboard'
  }
}

function getJobConfig(): JobConfig {
  const output = process.env.ARB_JOB_OUTPUT?.trim()

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
    output:
      output === 'notify' || output === 'review' || output === 'bundle'
        ? output
        : 'summary'
  }
}

async function main(): Promise<void> {
  const config = getJobConfig()
  const workflow = await loadWorkflow({
    listingsPath: config.listingsPath,
    labelsPath: config.labelsPath,
    configPath: config.configPath,
    limit: config.limit
  })

  const report = workflow.report
  const outputs = buildWorkflowOutputs(workflow.scores, config.channel)
  const payload = {
    service: 'arb-scan',
    generatedAt: new Date().toISOString(),
    inputs: {
      listingsPath: config.listingsPath,
      labelsPath: config.labelsPath,
      configPath: config.configPath,
      limit: config.limit,
      channel: config.channel
    },
    summary: formatMvpReport(report)
  }

  if (config.output === 'notify') {
    process.stdout.write(
      `${JSON.stringify({ ...payload, notifications: outputs.notifications }, null, 2)}\n`
    )
    return
  }

  if (config.output === 'review') {
    process.stdout.write(
      `${JSON.stringify({ ...payload, reviews: outputs.reviews }, null, 2)}\n`
    )
    return
  }

  if (config.output === 'bundle') {
    process.stdout.write(
      `${JSON.stringify(
        {
          ...payload,
          notifications: outputs.notifications,
          reviews: outputs.reviews,
          report
        },
        null,
        2
      )}\n`
    )
    return
  }

  process.stdout.write(`${payload.summary}\n`)
}

main().catch(error => {
  console.error((error as Error).message)
  process.exitCode = 1
})
