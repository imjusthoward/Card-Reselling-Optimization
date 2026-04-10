import type {
  OpportunityListing,
  SentimentFeedItem,
  SentimentSummary,
  SentimentTopicSignal,
  WatchlistEntry
} from './types.js'

const POSITIVE_TERMS = [
  'bull',
  'bullish',
  'hype',
  'hot',
  'moon',
  'pump',
  'spike',
  'up',
  'uptrend',
  'buy',
  'undervalued',
  'underpriced',
  'limited',
  'scarce',
  'restock',
  'reprint demand',
  'new set',
  'chase',
  '高騰',
  '値上がり',
  '上がる',
  '再販需要'
]

const NEGATIVE_TERMS = [
  'bear',
  'bearish',
  'dump',
  'down',
  'downtrend',
  'crash',
  'fall',
  'falling',
  'overpriced',
  'oversupply',
  'dead',
  'weak',
  'sell',
  'reprint',
  'mass reprint',
  '暴落',
  '下落',
  '供給過多'
]

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim()
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value)) {
    target.push(value)
  }
}

function scoreText(text: string): number {
  const normalized = normalizeText(text)
  if (!normalized) {
    return 0
  }

  let score = 0
  for (const term of POSITIVE_TERMS) {
    if (normalized.includes(normalizeText(term))) {
      score += 1
    }
  }

  for (const term of NEGATIVE_TERMS) {
    if (normalized.includes(normalizeText(term))) {
      score -= 1
    }
  }

  return score
}

function topicMatches(entry: WatchlistEntry, text: string): boolean {
  const normalized = normalizeText(text)
  if (!normalized) {
    return false
  }

  const candidates = [entry.title, ...(entry.searchTerms ?? []), entry.notes?.join(' ') ?? '']

  return candidates.some(candidate => {
    const normalizedCandidate = normalizeText(candidate)
    return normalizedCandidate.length > 0 && normalized.includes(normalizedCandidate)
  })
}

function updateTopicSignal(
  signals: Map<string, SentimentTopicSignal>,
  entry: WatchlistEntry,
  score: number,
  sourceText: string
): void {
  const current =
    signals.get(entry.id) ??
    {
      topic: entry.title,
      score: 0,
      bullishMentions: 0,
      bearishMentions: 0,
      mentionCount: 0,
      samplePhrases: []
    }

  current.mentionCount += 1
  current.score += score
  if (score > 0) {
    current.bullishMentions += 1
  } else if (score < 0) {
    current.bearishMentions += 1
  }

  if (sourceText) {
    addUnique(current.samplePhrases, sourceText.slice(0, 120))
  }

  signals.set(entry.id, current)
}

export function analyzeSentimentFeed(
  posts: SentimentFeedItem[] | undefined,
  watchlist: WatchlistEntry[]
): SentimentSummary {
  const items = Array.isArray(posts) ? posts : []
  const topicSignals = new Map<string, SentimentTopicSignal>()
  let bullishPosts = 0
  let bearishPosts = 0
  let netScore = 0

  for (const post of items) {
    const text = String(post?.text ?? '').trim()
    if (!text) {
      continue
    }

    const score = scoreText(text)
    if (score > 0) {
      bullishPosts += 1
    } else if (score < 0) {
      bearishPosts += 1
    }
    netScore += score

    for (const entry of watchlist) {
      if (topicMatches(entry, text)) {
        updateTopicSignal(topicSignals, entry, score, text)
      }
    }
  }

  return {
    totalPosts: items.length,
    bullishPosts,
    bearishPosts,
    netScore,
    topicSignals: [...topicSignals.values()].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
  }
}

export function getSentimentSignalForListing(
  listing: OpportunityListing,
  summary?: SentimentSummary
): SentimentTopicSignal | undefined {
  if (!summary || summary.topicSignals.length === 0) {
    return undefined
  }

  const candidates = [listing.matchedWatchlistId ?? '', listing.matchedWatchlistTitle ?? listing.title]
    .map(value => normalizeText(value))
    .filter(Boolean)

  for (const signal of summary.topicSignals) {
    const normalizedTopic = normalizeText(signal.topic)
    if (candidates.some(candidate => candidate === normalizedTopic || candidate.includes(normalizedTopic) || normalizedTopic.includes(candidate))) {
      return signal
    }
  }

  return undefined
}

export function buildSentimentAdjustment(
  listing: OpportunityListing,
  summary?: SentimentSummary
): { priorityMultiplier: number; reasons: string[] } {
  const signal = getSentimentSignalForListing(listing, summary)
  if (!signal) {
    return {
      priorityMultiplier: 1,
      reasons: []
    }
  }

  const reasons: string[] = []
  const magnitude = Math.min(0.15, Math.abs(signal.score) * 0.025)
  const priorityMultiplier = signal.score > 0 ? 1 + magnitude : 1 - magnitude

  if (signal.score > 0) {
    reasons.push('sentiment-bullish')
  } else if (signal.score < 0) {
    reasons.push('sentiment-bearish')
  }

  if (signal.samplePhrases.length > 0) {
    reasons.push(`sentiment:${signal.samplePhrases[0]}`)
  }

  return {
    priorityMultiplier: Math.max(0.8, Math.min(1.2, priorityMultiplier)),
    reasons
  }
}
