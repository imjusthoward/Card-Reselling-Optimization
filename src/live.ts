import { randomUUID } from 'node:crypto'
import {
  buildCalibration,
  buildMvpReport,
  buildNotificationPayload,
  buildTraderReviewPacket,
  formatNotificationPayload,
  formatTraderReviewPacket,
  scoreBatch,
  type CalibrationInput,
  type NotificationChannel,
  type OpportunityListing,
  type OpportunityScore,
  type Recommendation,
  type Marketplace,
  type ScrapedListing,
  type ScoringConfig,
  type TraderLabel,
  type WatchlistEntry
} from './index.js'
import { createArtifactStore, type ArtifactStore } from './artifacts.js'
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_LABELS_PATH,
  loadJson,
  resolveWorkflowPath
} from './workflow.js'

export const DEFAULT_WATCHLIST_PATH = 'data/watchlist.json'
export const DEFAULT_LIVE_SOURCES = ['mercari', 'yahoo_flea', 'snkrdunk'] as const

export type LiveMarketplace = (typeof DEFAULT_LIVE_SOURCES)[number]
export type LiveQueryStrategy = 'primary' | 'all'

interface LiveTask {
  watchlist: WatchlistEntry
  marketplace: LiveMarketplace
  query: string
}

export interface LiveSourceSummary {
  marketplace: LiveMarketplace
  query: string
  watchlistId: string
  resultCount: number
  status: 'ok' | 'empty' | 'unsupported' | 'error'
  note?: string
  durationMs?: number
}

export interface LiveScanOptions {
  watchlistPath?: string
  labelsPath?: string
  configPath?: string
  sourceFilter?: LiveMarketplace[]
  watchlistLimit?: number
  queryStrategy?: LiveQueryStrategy
  limitPerQuery?: number
  searchConcurrency?: number
  fetchTimeoutMs?: number
  maxNotifications?: number
  maxReviews?: number
  notificationChannel?: NotificationChannel
  artifactStore?: ArtifactStore
  alexWebhookUrl?: string
  notifyAlex?: boolean
  fetchImpl?: typeof fetch
  now?: () => Date
}

export interface LiveScanResult {
  scanId: string
  generatedAt: string
  watchlist: WatchlistEntry[]
  sourceSummaries: LiveSourceSummary[]
  scrapedListings: ScrapedListing[]
  opportunities: OpportunityListing[]
  scores: OpportunityScore[]
  limitedScores: OpportunityScore[]
  report: ReturnType<typeof buildMvpReport>
  notifications: ReturnType<typeof buildNotificationPayload>[]
  reviews: ReturnType<typeof buildTraderReviewPacket>[]
  alexDigest: string
  scanArtifactPath?: string
  inboxArtifactPath?: string
  unavailableSources: string[]
}

export interface FeedbackEntry extends TraderLabel {
  reviewer?: string
  reviewedAt?: string
  followUp?: string
  sourceUrl?: string
  sourceListingId?: string
  sourceQuery?: string
}

export interface LiveStateEntry {
  listingId: string
  marketplace: Marketplace
  title: string
  firstSeenAt: string
  lastSeenAt: string
  lastPriceJpy: number
  lastRecommendation: Recommendation
  lastPriorityScore: number
  notificationCount: number
  lastNotifiedAt?: string
  sourceUrl?: string
  sourceQuery?: string
  matchedWatchlistId?: string
  matchedWatchlistTitle?: string
}

export interface LiveState {
  scanId?: string
  generatedAt?: string
  entries: Record<string, LiveStateEntry>
}

export interface LiveAlertSelection {
  freshNotifications: ReturnType<typeof buildNotificationPayload>[]
  freshReviews: ReturnType<typeof buildTraderReviewPacket>[]
  state: LiveState
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function parseCurrency(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

function looksRelevant(title: string, query: string): boolean {
  const normalizedTitle = normalizeText(title)
  const normalizedQuery = normalizeText(query)

  if (!normalizedQuery) {
    return true
  }

  if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    return true
  }

  const queryTokens = unique(
    normalizedQuery
      .split(/[\s,/+\-_.:]+/g)
      .map(token => token.trim())
      .filter(token => token.length >= 2)
  )

  if (queryTokens.length === 0) {
    return normalizedTitle.includes(normalizedQuery)
  }

  const hits = queryTokens.filter(token => normalizedTitle.includes(token))
  return hits.length / queryTokens.length >= 0.5
}

function buildSearchUrl(marketplace: LiveMarketplace, query: string): string {
  const encoded = encodeURIComponent(query)

  switch (marketplace) {
    case 'mercari':
      return `https://jp.mercari.com/search?keyword=${encoded}`
    case 'yahoo_flea':
      return `https://paypayfleamarket.yahoo.co.jp/search/${encoded}`
    case 'snkrdunk':
      return `https://snkrdunk.com/search?keywords=${encoded}`
    default:
      return ''
  }
}

function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.min(Math.floor(concurrency), items.length || 1))
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const runNext = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  return Promise.all(Array.from({ length: limit }, () => runNext())).then(() => results)
}

function cloneListing(listing: ScrapedListing): ScrapedListing {
  return {
    ...listing,
    notes: listing.notes ? [...listing.notes] : undefined
  }
}

function mergeScrapedListings(existing: ScrapedListing, incoming: ScrapedListing): ScrapedListing {
  const notes = unique([...(existing.notes ?? []), ...(incoming.notes ?? [])])
  return {
    ...existing,
    title: existing.title || incoming.title,
    sourceUrl: existing.sourceUrl || incoming.sourceUrl,
    sourceQuery: existing.sourceQuery || incoming.sourceQuery,
    imageUrl: existing.imageUrl || incoming.imageUrl,
    sellerId: existing.sellerId || incoming.sellerId,
    sellerRating: existing.sellerRating ?? incoming.sellerRating,
    sellerSalesCount: existing.sellerSalesCount ?? incoming.sellerSalesCount,
    sellerResponseRate: existing.sellerResponseRate ?? incoming.sellerResponseRate,
    likeCount: existing.likeCount ?? incoming.likeCount,
    isPriceDown: existing.isPriceDown ?? incoming.isPriceDown,
    notes
  }
}

function dedupeScrapedListings(listings: ScrapedListing[]): ScrapedListing[] {
  const deduped = new Map<string, ScrapedListing>()

  for (const listing of listings) {
    const key = `${listing.marketplace}:${listing.sourceListingId}`
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, cloneListing(listing))
      continue
    }

    deduped.set(key, mergeScrapedListings(existing, listing))
  }

  return [...deduped.values()]
}

function buildSearchTasks(
  watchlist: WatchlistEntry[],
  sourceFilter: LiveMarketplace[],
  queryStrategy: LiveQueryStrategy
): LiveTask[] {
  const tasks: LiveTask[] = []

  for (const watch of watchlist) {
    for (const marketplace of watch.marketplaces as LiveMarketplace[]) {
      if (!sourceFilter.includes(marketplace)) {
        continue
      }

      const queries =
        queryStrategy === 'primary' ? watch.searchTerms.slice(0, 1) : watch.searchTerms

      for (const query of queries) {
        tasks.push({
          watchlist: watch,
          marketplace,
          query
        })
      }
    }
  }

  return tasks
}

function selectWatchlistForListing(
  listing: ScrapedListing,
  watchlist: WatchlistEntry[],
  fallbackIndex = 0
): WatchlistEntry {
  const queryMatches = watchlist.filter(entry =>
    entry.searchTerms.some(term => looksRelevant(listing.title, term))
  )

  if (queryMatches.length > 0) {
    return queryMatches.sort(
      (left, right) =>
        (right.liquidityScore ?? 0) - (left.liquidityScore ?? 0) ||
        right.cleanExitJpy - left.cleanExitJpy
    )[0]
  }

  return watchlist[fallbackIndex] ?? watchlist[0]
}

function buildOpportunityListing(
  source: ScrapedListing,
  watchlist: WatchlistEntry,
  generatedAt: string,
  query: string
): OpportunityListing {
  const notes = unique([
    ...(watchlist.notes ?? []),
    ...(source.notes ?? []),
    `watchlist:${watchlist.id}`,
    `query:${query}`
  ])

  return {
    id: `${source.marketplace}:${source.sourceListingId}`,
    title: source.title,
    marketplace: source.marketplace,
    riskGroup: watchlist.riskGroup,
    askingPriceJpy: source.askingPriceJpy,
    cleanExitJpy: watchlist.cleanExitJpy,
    damagedExitJpy: watchlist.damagedExitJpy,
    exitCostsJpy: watchlist.exitCostsJpy,
    salvageJpy: watchlist.salvageJpy,
    hasMarketplaceAuthentication:
      watchlist.hasMarketplaceAuthentication ?? source.marketplace === 'snkrdunk',
    priceSheetMatch: watchlist.priceSheetMatch ?? true,
    imageEvidence: source.imageUrl
      ? {
          photoCount: 1,
          frontVisible: true
        }
      : undefined,
    sellerSignals:
      source.sellerId || source.sellerRating != null || source.sellerSalesCount != null
        ? {
            rating: source.sellerRating,
            salesCount: source.sellerSalesCount,
            responseRate: source.sellerResponseRate
          }
        : undefined,
    liquidityScore: watchlist.liquidityScore,
    conditionConfidence: watchlist.riskGroup === 'sealed' ? 0.66 : 0.58,
    sourceUrl: source.sourceUrl,
    sourceListingId: source.sourceListingId,
    sourceQuery: query || source.sourceQuery,
    matchedWatchlistId: watchlist.id,
    matchedWatchlistTitle: watchlist.title,
    scrapedAt: generatedAt,
    imageUrls: source.imageUrl ? [source.imageUrl] : undefined,
    notes
  }
}

async function fetchHtml(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<string> {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'accept-language': 'ja-JP,ja;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(timeoutMs)
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function parseYahooFleaSearchPage(
  html: string,
  query: string,
  limit = 20
): ScrapedListing[] {
  const listings: ScrapedListing[] = []
  const anchorPattern = /<a\b[^>]*href="\/item\/(?<id>[^"]+)"[^>]*>(?<body>[\s\S]*?)<\/a>/g

  for (const match of html.matchAll(anchorPattern)) {
    const sourceListingId = match.groups?.id
    const body = match.groups?.body ?? ''
    const titleMatch = body.match(/<img[^>]*alt="(?<title>[^"]+)"/)
    const imageMatch = body.match(/<img[^>]*src="(?<src>[^"]+)"/)
    const priceMatch = body.match(/<p[^>]*>(?<price>[\d,]+)<!-- -->円<\/p>/)
    const paramsMatch = match[0].match(/data-cl-params="(?<params>[^"]+)"/)

    if (!sourceListingId || !titleMatch || !priceMatch) {
      continue
    }

    const title = decodeHtmlEntities(titleMatch.groups?.title ?? titleMatch[1] ?? '')
    const askingPriceJpy = parseCurrency(priceMatch.groups?.price ?? priceMatch[1] ?? '0')

    if (!looksRelevant(title, query)) {
      continue
    }

    const sellerId = paramsMatch?.groups?.params.match(/sellerid:([^;"]+)/)?.[1]

    listings.push({
      marketplace: 'yahoo_flea',
      sourceUrl: `https://paypayfleamarket.yahoo.co.jp/item/${sourceListingId}`,
      sourceListingId,
      sourceQuery: query,
      title,
      askingPriceJpy,
      imageUrl: imageMatch?.groups?.src ?? imageMatch?.[1],
      sellerId,
      notes: [`query:${query}`, 'source:yahoo_flea']
    })

    if (listings.length >= limit) {
      break
    }
  }

  return listings
}

function parseSnkrdunkSearchPage(
  html: string,
  query: string,
  limit = 20
): ScrapedListing[] {
  const listings: ScrapedListing[] = []
  const anchorPattern = /<a\b[^>]*class="[^"]*productTile[^"]*"[^>]*>(?<body>[\s\S]*?)<\/a>/g

  for (const match of html.matchAll(anchorPattern)) {
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1)
    const hrefMatch = openTag.match(/href="(?<href>[^"]+)"/)
    const labelMatch = openTag.match(/aria-label="(?<label>[^"]+)"/)
    const imageMatch = match[0].match(/<img[^>]*src="(?<src>[^"]+)"[^>]*alt="(?<alt>[^"]+)"/)

    if (!hrefMatch || !labelMatch) {
      continue
    }

    const href = hrefMatch.groups?.href ?? hrefMatch[1]
    const label = labelMatch.groups?.label ?? labelMatch[1] ?? ''
    const labelMatchResult = label.match(/^(?<title>.*)\s-\s¥(?<price>[\d,]+)$/)
    const title = decodeHtmlEntities(labelMatchResult?.groups?.title ?? label)
    const askingPriceJpy = parseCurrency(labelMatchResult?.groups?.price ?? '0')
    const sourceListingId = href.split('/').filter(Boolean).pop()

    if (!sourceListingId || !looksRelevant(title, query)) {
      continue
    }

    listings.push({
      marketplace: 'snkrdunk',
      sourceUrl: href.startsWith('http') ? href : `https://snkrdunk.com${href}`,
      sourceListingId,
      sourceQuery: query,
      title,
      askingPriceJpy,
      imageUrl: imageMatch?.groups?.src ?? imageMatch?.[1],
      notes: [`query:${query}`, 'source:snkrdunk']
    })

    if (listings.length >= limit) {
      break
    }
  }

  return listings
}

function parseMercariSearchPage(
  html: string,
  query: string,
  limit = 20
): ScrapedListing[] {
  const listings: ScrapedListing[] = []
  const anchorPattern = /<a\b[^>]*href="\/item\/(?<id>[^"]+)"[^>]*>(?<body>[\s\S]*?)<\/a>/g

  for (const match of html.matchAll(anchorPattern)) {
    const sourceListingId = match.groups?.id
    const body = match.groups?.body ?? ''
    const titleMatch = body.match(/<img[^>]*alt="(?<title>[^"]+)"/)
    const imageMatch = body.match(/<img[^>]*src="(?<src>[^"]+)"/)
    const priceMatch = body.match(/(?<price>[\d,]+)<!-- -->円/)

    if (!sourceListingId || !titleMatch || !priceMatch) {
      continue
    }

    const title = decodeHtmlEntities(titleMatch.groups?.title ?? titleMatch[1] ?? '')
    const askingPriceJpy = parseCurrency(priceMatch.groups?.price ?? priceMatch[1] ?? '0')

    if (!looksRelevant(title, query)) {
      continue
    }

    listings.push({
      marketplace: 'mercari',
      sourceUrl: `https://jp.mercari.com/item/${sourceListingId}`,
      sourceListingId,
      sourceQuery: query,
      title,
      askingPriceJpy,
      imageUrl: imageMatch?.groups?.src ?? imageMatch?.[1],
      notes: [`query:${query}`, 'source:mercari']
    })

    if (listings.length >= limit) {
      break
    }
  }

  return listings
}

async function scrapeMarketplaceSearch(
  marketplace: LiveMarketplace,
  query: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  limit = 20
): Promise<{ results: ScrapedListing[]; note?: string }> {
  const url = buildSearchUrl(marketplace, query)
  const html = await fetchHtml(url, fetchImpl, timeoutMs)
  const results = parseMarketplaceSearchPage(marketplace, html, query, limit)

  if (marketplace === 'mercari' && results.length === 0) {
    return {
      results,
      note: 'Mercari search page did not expose listing cards in the public HTML; browser-backed scraping is still required for that source.'
    }
  }

  return {
    results,
    note: results.length === 0 ? 'No relevant results' : undefined
  }
}

export function parseMarketplaceSearchPage(
  marketplace: LiveMarketplace,
  html: string,
  query: string,
  limit = 20
): ScrapedListing[] {
  switch (marketplace) {
    case 'yahoo_flea':
      return parseYahooFleaSearchPage(html, query, limit)
    case 'snkrdunk':
      return parseSnkrdunkSearchPage(html, query, limit)
    case 'mercari':
      return parseMercariSearchPage(html, query, limit)
    default:
      return []
  }
}

function buildAlexDigest(
  scanId: string,
  generatedAt: string,
  report: ReturnType<typeof buildMvpReport>,
  notifications: ReturnType<typeof buildNotificationPayload>[],
  reviews: ReturnType<typeof buildTraderReviewPacket>[],
  unavailableSources: string[]
): string {
  const topNotifications = notifications.slice(0, 5).map(formatNotificationPayload)
  const topReviews = reviews.slice(0, 5).map(formatTraderReviewPacket)

  return [
    'ALEX REVIEW PACK',
    `scan=${scanId}`,
    `generatedAt=${generatedAt}`,
    `pipeline=${report.pipeline.total} | notify=${report.pipeline.notifyCount} | review=${report.pipeline.reviewCount} | pass=${report.pipeline.passCount}`,
    `precision=${report.matched.precision == null ? 'n/a' : `${(report.matched.precision * 100).toFixed(1)}%`} | falsePositiveRate=${report.matched.falsePositiveRate == null ? 'n/a' : `${(report.matched.falsePositiveRate * 100).toFixed(1)}%`}`,
    '',
    'Top buy candidates:',
    ...(topNotifications.length > 0 ? topNotifications : ['- none']),
    '',
    'Top manual-review candidates:',
    ...(topReviews.length > 0 ? topReviews : ['- none']),
    '',
    'How to label:',
    '- authenticity: authentic | fake | uncertain',
    '- condition: clean | damaged | uncertain',
    '- recommendedAction: buy | watch | pass',
    '- confidence: 0 to 1',
    '- realizedProfitJpy: fill in after sale',
    '',
    unavailableSources.length > 0
      ? `Unavailable sources: ${unavailableSources.join(', ')}`
      : 'Unavailable sources: none',
    '',
    'Reply with short evidence-first notes. Confirm the identification, say what is wrong if anything, and state the next action.'
  ].join('\n')
}

function createEmptyLiveState(): LiveState {
  return {
    entries: {}
  }
}

export async function loadWatchlist(
  watchlistPath: string = DEFAULT_WATCHLIST_PATH
): Promise<WatchlistEntry[]> {
  const entries = await loadJson<WatchlistEntry[]>(
    resolveWorkflowPath(watchlistPath, DEFAULT_WATCHLIST_PATH)
  )

  return entries
    .filter(entry => entry.active !== false)
    .map(entry => ({
      ...entry,
      marketplaces: [...entry.marketplaces],
      searchTerms: [...entry.searchTerms],
      notes: entry.notes ? [...entry.notes] : undefined
    }))
}

export async function loadLatestLiveScan(
  artifactStore: ArtifactStore
): Promise<LiveScanResult | null> {
  return artifactStore.readJson<LiveScanResult>('scans/latest.json')
}

export async function loadLiveState(
  artifactStore: ArtifactStore
): Promise<LiveState> {
  return (await artifactStore.readJson<LiveState>('live/state.json')) ?? createEmptyLiveState()
}

export async function saveLiveState(
  state: LiveState,
  artifactStore: ArtifactStore
): Promise<void> {
  await artifactStore.writeJson('live/state.json', state)
}

export function selectFreshAlerts(
  scan: LiveScanResult,
  previousState: LiveState,
  options: {
    cooldownMinutes?: number
    channel?: NotificationChannel
  } = {}
): LiveAlertSelection {
  const cooldownMinutes = options.cooldownMinutes ?? 10
  const channel = options.channel ?? 'dashboard'
  const state: LiveState = {
    ...previousState,
    scanId: scan.scanId,
    generatedAt: scan.generatedAt,
    entries: { ...(previousState.entries ?? {}) }
  }
  const nowMs = Date.parse(scan.generatedAt)
  const cooldownMs = cooldownMinutes * 60_000
  const freshNotifications: ReturnType<typeof buildNotificationPayload>[] = []
  const freshReviews: ReturnType<typeof buildTraderReviewPacket>[] = []
  const scoreByListingId = new Map(
    scan.scores.map(score => [score.listing.id, score] as const)
  )

  for (const score of scan.scores) {
    const listing = score.listing
    const key = listing.id
    const previous = previousState.entries[key]
    state.entries[key] = {
      listingId: key,
      marketplace: listing.marketplace,
      title: listing.title,
      firstSeenAt: previous?.firstSeenAt ?? scan.generatedAt,
      lastSeenAt: scan.generatedAt,
      lastPriceJpy: listing.askingPriceJpy,
      lastRecommendation: score.recommendation,
      lastPriorityScore: score.priorityScore,
      notificationCount: previous?.notificationCount ?? 0,
      lastNotifiedAt: previous?.lastNotifiedAt,
      sourceUrl: listing.sourceUrl,
      sourceQuery: listing.sourceQuery,
      matchedWatchlistId: listing.matchedWatchlistId,
      matchedWatchlistTitle: listing.matchedWatchlistTitle
    }
  }

  const shouldEmit = (
    key: string,
    askingPriceJpy: number,
    recommendation: Recommendation,
    priorityScore: number,
    title: string,
    marketplace: Marketplace,
    sourceUrl?: string,
    sourceQuery?: string,
    matchedWatchlistId?: string,
    matchedWatchlistTitle?: string
  ): { emit: boolean; current: LiveStateEntry } => {
    const previous = previousState.entries[key]
    const current: LiveStateEntry = {
      listingId: key,
      marketplace,
      title,
      firstSeenAt: previous?.firstSeenAt ?? scan.generatedAt,
      lastSeenAt: scan.generatedAt,
      lastPriceJpy: askingPriceJpy,
      lastRecommendation: recommendation,
      lastPriorityScore: priorityScore,
      notificationCount: previous?.notificationCount ?? 0,
      lastNotifiedAt: previous?.lastNotifiedAt,
      sourceUrl,
      sourceQuery,
      matchedWatchlistId,
      matchedWatchlistTitle
    }

    const priceChanged = previous != null && previous.lastPriceJpy !== askingPriceJpy
    const cooldownExpired =
      previous?.lastNotifiedAt != null
        ? nowMs - Date.parse(previous.lastNotifiedAt) >= cooldownMs
        : true
    const emit = previous == null || priceChanged || cooldownExpired

    return { emit, current }
  }

  for (const payload of scan.notifications) {
    const score = scoreByListingId.get(payload.listingId)
    const { emit, current } = shouldEmit(
      payload.listingId,
      payload.askingPriceJpy,
      payload.traderAction,
      payload.priorityScore,
      payload.title,
      payload.marketplace as Marketplace,
      payload.sourceUrl,
      payload.sourceQuery,
      payload.matchedWatchlistId,
      payload.matchedWatchlistTitle
    )

    state.entries[payload.listingId] = current

    if (emit) {
      current.lastNotifiedAt = scan.generatedAt
      current.notificationCount = (previousState.entries[payload.listingId]?.notificationCount ?? 0) + 1
      if (score) {
        current.lastPriorityScore = score.priorityScore
        current.lastRecommendation = score.recommendation
      }
      const fallbackScore: OpportunityScore = {
        listing: {
          id: payload.listingId,
          title: payload.title,
          marketplace: payload.marketplace,
          riskGroup: payload.riskGroup,
          askingPriceJpy: payload.askingPriceJpy,
          cleanExitJpy: payload.askingPriceJpy,
          damagedExitJpy: payload.askingPriceJpy,
          sourceUrl: payload.sourceUrl,
          sourceListingId: payload.sourceListingId,
          sourceQuery: payload.sourceQuery,
          matchedWatchlistId: payload.matchedWatchlistId,
          matchedWatchlistTitle: payload.matchedWatchlistTitle
        },
        expectedExitJpy: payload.askingPriceJpy,
        expectedNetJpy: payload.expectedNetJpy,
        expectedReturnPct: payload.expectedReturnPct,
        authProbability: payload.authProbability,
        cleanProbability: payload.cleanProbability,
        fakeProbability: 1 - payload.authProbability,
        confidence: payload.confidence,
        priorityScore: payload.priorityScore,
        recommendation: payload.traderAction,
        reasons: payload.reasons
      }

      freshNotifications.push(buildNotificationPayload(score ?? fallbackScore, channel))
    }
  }

  for (const packet of scan.reviews) {
    const score = scoreByListingId.get(packet.listingId)
    const { emit, current } = shouldEmit(
      packet.listingId,
      packet.askingPriceJpy,
      'watch',
      score?.priorityScore ?? 0,
      packet.title,
      packet.marketplace as Marketplace,
      packet.sourceUrl,
      packet.sourceQuery,
      packet.matchedWatchlistId,
      packet.matchedWatchlistTitle
    )

    state.entries[packet.listingId] = current

    if (emit) {
      current.lastNotifiedAt = scan.generatedAt
      current.notificationCount = (previousState.entries[packet.listingId]?.notificationCount ?? 0) + 1
      if (score) {
        current.lastPriorityScore = score.priorityScore
        current.lastRecommendation = score.recommendation
      }
      const fallbackReviewScore: OpportunityScore = {
        listing: {
          id: packet.listingId,
          title: packet.title,
          marketplace: packet.marketplace,
          riskGroup: packet.riskGroup,
          askingPriceJpy: packet.askingPriceJpy,
          cleanExitJpy: packet.cleanExitJpy,
          damagedExitJpy: packet.damagedExitJpy,
          sourceUrl: packet.sourceUrl,
          sourceListingId: packet.sourceListingId,
          sourceQuery: packet.sourceQuery,
          matchedWatchlistId: packet.matchedWatchlistId,
          matchedWatchlistTitle: packet.matchedWatchlistTitle
        },
        expectedExitJpy: packet.expectedNetJpy + packet.askingPriceJpy,
        expectedNetJpy: packet.expectedNetJpy,
        expectedReturnPct: packet.expectedReturnPct,
        authProbability: packet.authProbability,
        cleanProbability: packet.cleanProbability,
        fakeProbability: 1 - packet.authProbability,
        confidence: packet.confidence,
        priorityScore: score?.priorityScore ?? 0,
        recommendation: 'watch',
        reasons: packet.evidence
      }

      freshReviews.push(buildTraderReviewPacket(score ?? fallbackReviewScore))
    }
  }

  return {
    freshNotifications,
    freshReviews,
    state
  }
}

export async function recordAlexFeedback(
  feedback: FeedbackEntry,
  artifactStore: ArtifactStore
): Promise<FeedbackEntry> {
  const normalized: FeedbackEntry = {
    ...feedback,
    reviewer: feedback.reviewer?.trim() || 'alex',
    reviewedAt: feedback.reviewedAt?.trim() || new Date().toISOString(),
    notes: feedback.notes?.trim() || undefined,
    sourceUrl: feedback.sourceUrl?.trim() || undefined,
    sourceListingId: feedback.sourceListingId?.trim() || undefined,
    sourceQuery: feedback.sourceQuery?.trim() || undefined,
    followUp: feedback.followUp?.trim() || undefined
  }

  const reviewedAt = normalized.reviewedAt ?? new Date().toISOString()
  const filePath = `feedback/${reviewedAt.slice(0, 10)}/${normalized.listingId}-${randomUUID()}.json`
  await artifactStore.writeJson(filePath, normalized)

  const latest = (await artifactStore.readJson<FeedbackEntry[]>('feedback/latest.json')) ?? []
  latest.unshift(normalized)
  await artifactStore.writeJson('feedback/latest.json', latest.slice(0, 100))

  return normalized
}

export async function listAlexFeedback(
  artifactStore: ArtifactStore,
  limit = 50
): Promise<FeedbackEntry[]> {
  const entries = (await artifactStore.readJson<FeedbackEntry[]>('feedback/latest.json')) ?? []
  return entries.slice(0, limit)
}

export async function runLiveScan(
  options: LiveScanOptions = {}
): Promise<LiveScanResult> {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString()
  const scanId = randomUUID()
  const watchlist = await loadWatchlist(options.watchlistPath)
  const selectedWatchlist = watchlist.slice(0, options.watchlistLimit ?? watchlist.length)
  const labels = await loadJson<TraderLabel[]>(
    resolveWorkflowPath(options.labelsPath, DEFAULT_LABELS_PATH)
  )
  const scoringConfig = await loadJson<Partial<ScoringConfig & CalibrationInput>>(
    resolveWorkflowPath(options.configPath, DEFAULT_CONFIG_PATH)
  )
  const calibration = buildCalibration(labels, scoringConfig)
  const sourceFilter = options.sourceFilter ?? [...DEFAULT_LIVE_SOURCES]
  const queryStrategy = options.queryStrategy ?? 'all'
  const fetchImpl = options.fetchImpl ?? fetch
  const limitPerQuery = options.limitPerQuery ?? 20
  const searchConcurrency = options.searchConcurrency ?? 6
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 12_000
  const maxNotifications = options.maxNotifications ?? 5
  const maxReviews = options.maxReviews ?? 5
  const artifactStore =
    options.artifactStore ??
    createArtifactStore(process.env.ARB_STORAGE_BUCKET ?? process.env.ARB_EVIDENCE_BUCKET)

  const tasks = buildSearchTasks(selectedWatchlist, sourceFilter, queryStrategy)
  const taskResults = await runWithConcurrency(tasks, searchConcurrency, async task => {
    const startedAt = Date.now()

    try {
      const { results, note } = await scrapeMarketplaceSearch(
        task.marketplace,
        task.query,
        fetchImpl,
        fetchTimeoutMs,
        limitPerQuery
      )

      return {
        task,
        results,
        note,
        durationMs: Date.now() - startedAt
      }
    } catch (error) {
      return {
        task,
        results: [] as ScrapedListing[],
        note: (error as Error).message,
        error: true,
        durationMs: Date.now() - startedAt
      }
    }
  })

  const sourceSummaries: LiveSourceSummary[] = []
  const scrapedListings: ScrapedListing[] = []
  const unavailableSources: string[] = []

  for (const result of taskResults) {
    const status: LiveSourceSummary['status'] =
      'error' in result && result.error
        ? 'error'
        : result.note != null && result.results.length === 0
          ? result.task.marketplace === 'mercari'
            ? 'unsupported'
            : 'empty'
          : 'ok'

    sourceSummaries.push({
      marketplace: result.task.marketplace,
      query: result.task.query,
      watchlistId: result.task.watchlist.id,
      resultCount: result.results.length,
      status,
      note: result.note,
      durationMs: result.durationMs
    })

    if (status === 'unsupported' || status === 'error') {
      unavailableSources.push(`${result.task.marketplace}:${result.task.query}`)
    }

    for (const listing of result.results) {
      scrapedListings.push({
        ...listing,
        sourceQuery: listing.sourceQuery ?? result.task.query,
        notes: unique([
          ...(listing.notes ?? []),
          `watchlist:${result.task.watchlist.id}`,
          `query:${result.task.query}`
        ])
      })
    }
  }

  const dedupedListings = dedupeScrapedListings(scrapedListings)
  const opportunityIndex = new Map<
    string,
    { listing: ScrapedListing; watchlist: WatchlistEntry; query: string }
  >()

  for (const listing of dedupedListings) {
    const query = listing.sourceQuery ?? ''
    const watchlistEntry = selectWatchlistForListing(listing, selectedWatchlist)
    const key = `${listing.marketplace}:${listing.sourceListingId}`
    const current = opportunityIndex.get(key)

    if (!current) {
      opportunityIndex.set(key, {
        listing,
        watchlist: watchlistEntry,
        query
      })
      continue
    }

    const currentScore = current.watchlist.liquidityScore ?? 0
    const nextScore = watchlistEntry.liquidityScore ?? 0

    if (nextScore > currentScore) {
      opportunityIndex.set(key, {
        listing,
        watchlist: watchlistEntry,
        query
      })
    }
  }

  const opportunities = [...opportunityIndex.values()].map(entry =>
    buildOpportunityListing(entry.listing, entry.watchlist, generatedAt, entry.query)
  )

  const scores = scoreBatch(opportunities, calibration, scoringConfig)
  const limitedScores = scores
  const report = buildMvpReport(limitedScores, labels)
  const notifications = limitedScores
    .filter(score => score.recommendation === 'buy')
    .slice(0, maxNotifications)
    .map(score => buildNotificationPayload(score, options.notificationChannel ?? 'dashboard'))
  const reviews = limitedScores
    .filter(score => score.recommendation !== 'pass')
    .slice(0, maxReviews)
    .map(score => buildTraderReviewPacket(score))
  const alexDigest = buildAlexDigest(
    scanId,
    generatedAt,
    report,
    notifications,
    reviews,
    unavailableSources
  )
  const scanArtifactPath = `scans/${generatedAt.slice(0, 10)}/${scanId}.json`
  const inboxArtifactPath = `inbox/${generatedAt.slice(0, 10)}/${scanId}.json`

  await artifactStore.writeJson('scans/latest.json', {
    scanId,
    generatedAt,
    watchlist: selectedWatchlist,
    sourceSummaries,
    scrapedListings: dedupedListings,
    opportunities,
    scores: limitedScores,
    report,
    notifications,
    reviews,
    alexDigest,
    unavailableSources
  })
  await artifactStore.writeJson(scanArtifactPath, {
    scanId,
    generatedAt,
    watchlist: selectedWatchlist,
    sourceSummaries,
    scrapedListings: dedupedListings,
    opportunities,
    scores: limitedScores,
    report,
    notifications,
    reviews,
    alexDigest,
    unavailableSources
  })
  await artifactStore.writeJson('inbox/latest.json', {
    scanId,
    generatedAt,
    notifications,
    reviews,
    alexDigest,
    sourceSummaries
  })
  await artifactStore.writeJson(inboxArtifactPath, {
    scanId,
    generatedAt,
    notifications,
    reviews,
    alexDigest,
    sourceSummaries
  })

  if (options.notifyAlex !== false && options.alexWebhookUrl?.trim()) {
    const response = await fetchImpl(options.alexWebhookUrl.trim(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        scanId,
        generatedAt,
        text: alexDigest,
        notifications,
        reviews,
        sourceSummaries
      }),
      signal: AbortSignal.timeout(fetchTimeoutMs)
    })

    if (!response.ok) {
      throw new Error(
        `Failed to dispatch Alex webhook: ${response.status} ${response.statusText}`
      )
    }
  }

  return {
    scanId,
    generatedAt,
    watchlist: selectedWatchlist,
    sourceSummaries,
    scrapedListings: dedupedListings,
    opportunities,
    scores: limitedScores,
    limitedScores,
    report,
    notifications,
    reviews,
    alexDigest,
    scanArtifactPath,
    inboxArtifactPath,
    unavailableSources
  }
}

export { buildSearchUrl, parseYahooFleaSearchPage, parseSnkrdunkSearchPage, parseMercariSearchPage }
