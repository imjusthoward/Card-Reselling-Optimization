#!/usr/bin/env node
import { formatNotificationPayload, formatTraderReviewPacket } from './index.js'
import {
  createArtifactStore,
  type ArtifactStore
} from './artifacts.js'
import {
  loadLiveState,
  runLiveScan,
  saveLiveState,
  selectFreshAlerts,
  type LiveMarketplace,
  type LiveQueryStrategy
} from './live.js'

interface WorkerConfig {
  pollIntervalMs: number
  cooldownMinutes: number
  watchlistLimit?: number
  queryStrategy: LiveQueryStrategy
  sourceFilter?: LiveMarketplace[]
  limitPerQuery?: number
  searchConcurrency?: number
  fetchTimeoutMs?: number
  maxNotifications?: number
  maxReviews?: number
  channel: 'dashboard' | 'whatsapp' | 'sms' | 'telegram' | 'discord' | 'email'
  alexWebhookUrl?: string
  artifactStore: ArtifactStore
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

function parseChannel(
  value: string | undefined
): WorkerConfig['channel'] {
  switch (value?.trim()) {
    case 'whatsapp':
    case 'sms':
    case 'telegram':
    case 'discord':
    case 'email':
      return value.trim() as WorkerConfig['channel']
    default:
      return 'dashboard'
  }
}

function createWorkerConfig(): WorkerConfig {
  return {
    pollIntervalMs: (parseOptionalInt(process.env.ARB_POLL_INTERVAL_SECONDS) ?? 30) * 1000,
    cooldownMinutes: parseOptionalInt(process.env.ARB_ALERT_COOLDOWN_MINUTES) ?? 10,
    watchlistLimit: parseOptionalInt(process.env.ARB_LIVE_WATCHLIST_LIMIT),
    queryStrategy: parseQueryStrategy(process.env.ARB_QUERY_STRATEGY),
    sourceFilter: parseSourceFilter(process.env.ARB_SOURCE_FILTER),
    limitPerQuery: parseOptionalInt(process.env.ARB_LIMIT_PER_QUERY),
    searchConcurrency: parseOptionalInt(process.env.ARB_SEARCH_CONCURRENCY),
    fetchTimeoutMs: parseOptionalInt(process.env.ARB_FETCH_TIMEOUT_MS),
    maxNotifications: parseOptionalInt(process.env.ARB_MAX_NOTIFICATIONS),
    maxReviews: parseOptionalInt(process.env.ARB_MAX_REVIEWS),
    channel: parseChannel(process.env.ARB_CHANNEL),
    alexWebhookUrl: process.env.ARB_ALEX_WEBHOOK_URL?.trim() || undefined,
    artifactStore: createArtifactStore(
      process.env.ARB_STORAGE_BUCKET ?? process.env.ARB_EVIDENCE_BUCKET
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildWorkerDigest(
  scanId: string,
  generatedAt: string,
  notifications: ReturnType<typeof formatNotificationPayload>[],
  reviews: ReturnType<typeof formatTraderReviewPacket>[],
  unavailableSources: string[]
): string {
  return [
    'LIVE ARBITRAGE ALERT',
    `scan=${scanId}`,
    `generatedAt=${generatedAt}`,
    '',
    'Fresh buy candidates:',
    ...(notifications.length > 0 ? notifications : ['- none']),
    '',
    'Fresh review candidates:',
    ...(reviews.length > 0 ? reviews : ['- none']),
    '',
    unavailableSources.length > 0
      ? `Unavailable sources: ${unavailableSources.join(', ')}`
      : 'Unavailable sources: none',
    '',
    'Alex: confirm authenticity, condition, and next action on the review items.'
  ].join('\n')
}

async function postWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  })

  if (!response.ok) {
    throw new Error(`Failed to dispatch worker webhook: ${response.status} ${response.statusText}`)
  }
}

async function runOnce(config: WorkerConfig): Promise<void> {
  const state = await loadLiveState(config.artifactStore)
  const scan = await runLiveScan({
    artifactStore: config.artifactStore,
    watchlistLimit: config.watchlistLimit,
    queryStrategy: config.queryStrategy,
    sourceFilter: config.sourceFilter,
    limitPerQuery: config.limitPerQuery,
    searchConcurrency: config.searchConcurrency,
    fetchTimeoutMs: config.fetchTimeoutMs,
    maxNotifications: config.maxNotifications,
    maxReviews: config.maxReviews,
    notificationChannel: config.channel,
    notifyAlex: false
  })

  const selection = selectFreshAlerts(scan, state, {
    cooldownMinutes: config.cooldownMinutes,
    channel: config.channel
  })

  await saveLiveState(selection.state, config.artifactStore)

  const digest = buildWorkerDigest(
    scan.scanId,
    scan.generatedAt,
    selection.freshNotifications.map(formatNotificationPayload),
    selection.freshReviews.map(formatTraderReviewPacket),
    scan.unavailableSources
  )

  if (config.alexWebhookUrl) {
    await postWebhook(config.alexWebhookUrl, {
      scanId: scan.scanId,
      generatedAt: scan.generatedAt,
      text: digest,
      notifications: selection.freshNotifications,
      reviews: selection.freshReviews,
      sourceSummaries: scan.sourceSummaries
    })
  } else {
    process.stdout.write(`${digest}\n`)
  }
}

async function main(): Promise<void> {
  const config = createWorkerConfig()
  let cycle = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startedAt = Date.now()
    cycle += 1

    try {
      await runOnce(config)
    } catch (error) {
      console.error(
        `[live-worker] cycle ${cycle} failed: ${(error as Error).message}`
      )
    }

    const elapsedMs = Date.now() - startedAt
    const delayMs = Math.max(0, config.pollIntervalMs - elapsedMs)
    await sleep(delayMs)
  }
}

main().catch(error => {
  console.error((error as Error).message)
  process.exitCode = 1
})
