#!/usr/bin/env node
import { formatMvpReport, type NotificationChannel } from './index.js'
import { createArtifactStore } from './artifacts.js'
import {
  DEFAULT_WATCHLIST_PATH,
  loadLiveState,
  runLiveScan,
  saveLiveState,
  selectFreshAlerts,
  type LiveMarketplace,
  type LiveQueryStrategy
} from './live.js'
import {
  buildWorkflowOutputs,
  loadWorkflow,
  resolveWorkflowPath,
  DEFAULT_CONFIG_PATH,
  DEFAULT_LABELS_PATH,
  DEFAULT_LISTINGS_PATH
} from './workflow.js'

interface JobConfig {
  mode: 'live' | 'batch'
  listingsPath: string
  labelsPath?: string
  configPath?: string
  watchlistPath?: string
  watchlistLimit?: number
  queryStrategy: LiveQueryStrategy
  sourceFilter?: LiveMarketplace[]
  limitPerQuery?: number
  searchConcurrency?: number
  fetchTimeoutMs?: number
  maxNotifications?: number
  maxReviews?: number
  channel: NotificationChannel
  output: 'summary' | 'notify' | 'review' | 'bundle'
  notifyAlex: boolean
  alexWebhookUrl?: string
  sentimentPath?: string
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function parseSourceFilter(value: string | undefined): LiveMarketplace[] | undefined {
  const raw = value?.trim()
  if (!raw) {
    return undefined
  }

  const values = raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean) as LiveMarketplace[]

  return values.length > 0 ? values : undefined
}

function parseQueryStrategy(value: string | undefined): LiveQueryStrategy {
  return value?.trim() === 'primary' ? 'primary' : 'all'
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
  const mode = process.env.ARB_JOB_MODE?.trim() === 'batch' ? 'batch' : 'live'

  return {
    mode,
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
    watchlistPath:
      process.env.ARB_WATCHLIST_PATH == null
        ? DEFAULT_WATCHLIST_PATH
        : resolveWorkflowPath(process.env.ARB_WATCHLIST_PATH, DEFAULT_WATCHLIST_PATH),
    watchlistLimit: parseOptionalInt(process.env.ARB_LIVE_WATCHLIST_LIMIT),
    queryStrategy: parseQueryStrategy(process.env.ARB_QUERY_STRATEGY),
    sourceFilter: parseSourceFilter(process.env.ARB_SOURCE_FILTER),
    limitPerQuery: parseOptionalInt(process.env.ARB_LIMIT_PER_QUERY),
    searchConcurrency: parseOptionalInt(process.env.ARB_SEARCH_CONCURRENCY),
    fetchTimeoutMs: parseOptionalInt(process.env.ARB_FETCH_TIMEOUT_MS),
    maxNotifications: parseOptionalInt(process.env.ARB_MAX_NOTIFICATIONS),
    maxReviews: parseOptionalInt(process.env.ARB_MAX_REVIEWS),
    channel: parseChannel(process.env.ARB_CHANNEL),
    output:
      output === 'notify' || output === 'review' || output === 'bundle'
        ? output
        : 'summary',
    notifyAlex: parseBoolean(process.env.ARB_NOTIFY_ALEX, false),
    alexWebhookUrl: process.env.ARB_ALEX_WEBHOOK_URL?.trim() || undefined,
    sentimentPath: process.env.ARB_SENTIMENT_PATH?.trim() || undefined
  }
}

async function main(): Promise<void> {
  const config = getJobConfig()

  if (config.mode === 'batch') {
    const workflow = await loadWorkflow({
      listingsPath: config.listingsPath,
      labelsPath: config.labelsPath,
      configPath: config.configPath
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
    return
  }

  const artifactStore = createArtifactStore(
    process.env.ARB_STORAGE_BUCKET ?? process.env.ARB_EVIDENCE_BUCKET
  )
  const scan = await runLiveScan({
    watchlistPath: config.watchlistPath,
    labelsPath: config.labelsPath,
    configPath: config.configPath,
    watchlistLimit: config.watchlistLimit,
    queryStrategy: config.queryStrategy,
    sourceFilter: config.sourceFilter,
    limitPerQuery: config.limitPerQuery,
    searchConcurrency: config.searchConcurrency,
      fetchTimeoutMs: config.fetchTimeoutMs,
      maxNotifications: config.maxNotifications,
      maxReviews: config.maxReviews,
      sentimentPath: config.sentimentPath,
      notificationChannel: config.channel,
      artifactStore,
      alexWebhookUrl: config.alexWebhookUrl,
    notifyAlex: config.notifyAlex
  })
  const state = await loadLiveState(artifactStore)
  const fresh = selectFreshAlerts(scan, state, {
    channel: config.channel
  })
  await saveLiveState(fresh.state, artifactStore)

  if (config.output === 'notify') {
    process.stdout.write(
      `${JSON.stringify(
        {
          service: 'arb-scan',
          generatedAt: scan.generatedAt,
          scanId: scan.scanId,
          notifications: fresh.freshNotifications
        },
        null,
        2
      )}\n`
    )
    return
  }

  if (config.output === 'review') {
    process.stdout.write(
      `${JSON.stringify(
        {
          service: 'arb-scan',
          generatedAt: scan.generatedAt,
          scanId: scan.scanId,
          reviews: fresh.freshReviews
        },
        null,
        2
      )}\n`
    )
    return
  }

  if (config.output === 'bundle') {
    process.stdout.write(
      `${JSON.stringify(
        {
          service: 'arb-scan',
          generatedAt: scan.generatedAt,
          scanId: scan.scanId,
          summary: scan.alexDigest,
          notifications: fresh.freshNotifications,
          reviews: fresh.freshReviews,
          report: scan.report
        },
        null,
        2
      )}\n`
    )
    return
  }

  process.stdout.write(`${scan.alexDigest}\n`)
}

main().catch(error => {
  console.error((error as Error).message)
  process.exitCode = 1
})
