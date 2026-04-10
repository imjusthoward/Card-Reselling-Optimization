#!/usr/bin/env node
import {
  formatNotificationPayload,
  formatTraderReviewPacket
} from './index.js'
import {
  DEFAULT_WATCHLIST_PATH,
  runLiveScan,
  type LiveMarketplace,
  type LiveQueryStrategy
} from './live.js'

interface ScanOptions {
  watchlistPath?: string
  labelsPath?: string
  configPath?: string
  output: 'digest' | 'json' | 'bundle'
  watchlistLimit?: number
  queryStrategy: LiveQueryStrategy
  sourceFilter?: LiveMarketplace[]
  limitPerQuery?: number
  searchConcurrency?: number
  fetchTimeoutMs?: number
  maxNotifications?: number
  maxReviews?: number
  channel: 'dashboard' | 'whatsapp' | 'sms' | 'telegram' | 'discord' | 'email'
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

function parseChannel(
  value: string | undefined
): ScanOptions['channel'] {
  switch (value?.trim()) {
    case 'whatsapp':
    case 'sms':
    case 'telegram':
    case 'discord':
    case 'email':
      return value.trim() as ScanOptions['channel']
    default:
      return 'dashboard'
  }
}

function parseArgs(argv: string[]): ScanOptions {
  const options: ScanOptions = {
    output: 'digest',
    queryStrategy: parseQueryStrategy(process.env.ARB_QUERY_STRATEGY),
    channel: parseChannel(process.env.ARB_CHANNEL),
    notifyAlex: parseBoolean(process.env.ARB_NOTIFY_ALEX, true),
    sentimentPath: process.env.ARB_SENTIMENT_PATH?.trim() || undefined
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = argv[index + 1]

    switch (argument) {
      case '--watchlist':
        if (!next) throw new Error('Missing value for --watchlist')
        options.watchlistPath = next
        index += 1
        break
      case '--labels':
        if (!next) throw new Error('Missing value for --labels')
        options.labelsPath = next
        index += 1
        break
      case '--config':
        if (!next) throw new Error('Missing value for --config')
        options.configPath = next
        index += 1
        break
      case '--output':
        if (!next) throw new Error('Missing value for --output')
        if (next !== 'digest' && next !== 'json' && next !== 'bundle') {
          throw new Error('Output must be one of digest, json, or bundle')
        }
        options.output = next
        index += 1
        break
      case '--watchlist-limit':
        if (!next) throw new Error('Missing value for --watchlist-limit')
        options.watchlistLimit = Number(next)
        index += 1
        break
      case '--query-strategy':
        if (!next) throw new Error('Missing value for --query-strategy')
        options.queryStrategy = parseQueryStrategy(next)
        index += 1
        break
      case '--source-filter':
        if (!next) throw new Error('Missing value for --source-filter')
        options.sourceFilter = parseSourceFilter(next)
        index += 1
        break
      case '--limit-per-query':
        if (!next) throw new Error('Missing value for --limit-per-query')
        options.limitPerQuery = Number(next)
        index += 1
        break
      case '--search-concurrency':
        if (!next) throw new Error('Missing value for --search-concurrency')
        options.searchConcurrency = Number(next)
        index += 1
        break
      case '--fetch-timeout-ms':
        if (!next) throw new Error('Missing value for --fetch-timeout-ms')
        options.fetchTimeoutMs = Number(next)
        index += 1
        break
      case '--max-notifications':
        if (!next) throw new Error('Missing value for --max-notifications')
        options.maxNotifications = Number(next)
        index += 1
        break
      case '--max-reviews':
        if (!next) throw new Error('Missing value for --max-reviews')
        options.maxReviews = Number(next)
        index += 1
        break
      case '--channel':
        if (!next) throw new Error('Missing value for --channel')
        options.channel = parseChannel(next)
        index += 1
        break
      case '--notify-alex':
        options.notifyAlex = true
        break
      case '--no-notify-alex':
        options.notifyAlex = false
        break
      case '--alex-webhook-url':
        if (!next) throw new Error('Missing value for --alex-webhook-url')
        options.alexWebhookUrl = next
        index += 1
        break
      default:
        break
    }
  }

  return options
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const result = await runLiveScan({
    watchlistPath:
      options.watchlistPath == null ? DEFAULT_WATCHLIST_PATH : options.watchlistPath,
    labelsPath: options.labelsPath,
    configPath: options.configPath,
    watchlistLimit: options.watchlistLimit,
    queryStrategy: options.queryStrategy,
    sourceFilter: options.sourceFilter,
    limitPerQuery: options.limitPerQuery,
    searchConcurrency: options.searchConcurrency,
    fetchTimeoutMs: options.fetchTimeoutMs,
    maxNotifications: options.maxNotifications,
    maxReviews: options.maxReviews,
    sentimentPath: options.sentimentPath,
    notificationChannel: options.channel,
    notifyAlex: options.notifyAlex,
    alexWebhookUrl: options.alexWebhookUrl
  })

  if (options.output === 'json') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  if (options.output === 'bundle') {
    process.stdout.write(
      `${JSON.stringify(
        {
          scanId: result.scanId,
          generatedAt: result.generatedAt,
          digest: result.alexDigest,
          notifications: result.notifications,
          reviews: result.reviews,
          sourceSummaries: result.sourceSummaries,
          unavailableSources: result.unavailableSources
        },
        null,
        2
      )}\n`
    )
    return
  }

  const digest = [
    result.alexDigest,
    '',
    'Notification payloads:',
    ...(result.notifications.length > 0
      ? result.notifications.map(formatNotificationPayload)
      : ['- none']),
    '',
    'Review payloads:',
    ...(result.reviews.length > 0
      ? result.reviews.map(formatTraderReviewPacket)
      : ['- none'])
  ].join('\n')

  process.stdout.write(`${digest}\n`)
}

main().catch(error => {
  console.error((error as Error).message)
  process.exitCode = 1
})
