import {
  type OpportunityScore,
  type Recommendation,
  type TraderLabel
} from './types.js'
import { formatPhotoPregrade } from './pregrader.js'

export const NOTIFICATION_CHANNELS = [
  'dashboard',
  'whatsapp',
  'sms',
  'telegram',
  'discord',
  'email'
] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export type MvpStage = 'notify' | 'review' | 'pass'

export interface NotificationPayload {
  listingId: string
  channel: NotificationChannel
  stage: MvpStage
  title: string
  marketplace: OpportunityScore['listing']['marketplace']
  riskGroup: OpportunityScore['listing']['riskGroup']
  askingPriceJpy: number
  expectedNetJpy: number
  expectedReturnPct: number
  confidence: number
  authProbability: number
  cleanProbability: number
  priorityScore: number
  traderAction: Recommendation
  summary: string
  reasons: string[]
  sourceUrl?: string
  sourceListingId?: string
  sourceQuery?: string
  matchedWatchlistId?: string
  matchedWatchlistTitle?: string
}

export interface ReviewField {
  key: 'authenticity' | 'condition' | 'recommendedAction' | 'confidence' | 'realizedProfitJpy'
  allowedValues: string[]
  guidance: string
}

export interface TraderReviewPacket {
  listingId: string
  stage: MvpStage
  title: string
  marketplace: OpportunityScore['listing']['marketplace']
  riskGroup: OpportunityScore['listing']['riskGroup']
  askingPriceJpy: number
  cleanExitJpy: number
  damagedExitJpy: number
  expectedNetJpy: number
  expectedReturnPct: number
  confidence: number
  authProbability: number
  cleanProbability: number
  evidence: string[]
  question: string
  labelFields: ReviewField[]
  sourceUrl?: string
  sourceListingId?: string
  sourceQuery?: string
  matchedWatchlistId?: string
  matchedWatchlistTitle?: string
}

export interface ScorePipelineSummary {
  total: number
  notifyCount: number
  reviewCount: number
  passCount: number
  averageExpectedNetJpy: number | null
  averagePriorityScore: number | null
  averageConfidence: number | null
  averageAuthProbability: number | null
  averageCleanProbability: number | null
}

export interface LabelFeedbackSummary {
  totalLabels: number
  authenticCount: number
  fakeCount: number
  uncertainAuthenticityCount: number
  cleanCount: number
  damagedCount: number
  uncertainConditionCount: number
  buyCount: number
  watchCount: number
  passCount: number
  averageConfidence: number | null
  averageRealizedProfitJpy: number | null
  positiveProfitRate: number | null
}

export interface MatchedLabelSummary {
  matchedLabels: number
  buySignals: number
  confirmedBuys: number
  falsePositiveCount: number
  precision: number | null
  falsePositiveRate: number | null
  averageRealizedProfitJpy: number | null
}

export interface InfrastructureChecklist {
  requiredNow: string[]
  recommendedSoon: string[]
  deferUntilLater: string[]
}

export interface MvpReport {
  pipeline: ScorePipelineSummary
  labels: LabelFeedbackSummary
  matched: MatchedLabelSummary
  infrastructure: InfrastructureChecklist
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function formatJpy(value: number): string {
  return `JPY ${Math.round(value).toLocaleString('en-US')}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatOptionalJpy(value: number | null): string {
  return value == null ? 'n/a' : formatJpy(value)
}

function formatOptionalPercent(value: number | null): string {
  return value == null ? 'n/a' : formatPercent(value)
}

function addEvidence(target: string[], candidate?: string): void {
  if (candidate && !target.includes(candidate)) {
    target.push(candidate)
  }
}

export function classifyOpportunityStage(score: OpportunityScore): MvpStage {
  if (score.recommendation === 'buy') {
    return 'notify'
  }

  if (score.recommendation === 'watch') {
    return 'review'
  }

  return 'pass'
}

export function buildNotificationPayload(
  score: OpportunityScore,
  channel: NotificationChannel = 'dashboard'
): NotificationPayload {
  const stage = classifyOpportunityStage(score)

  return {
    listingId: score.listing.id,
    channel,
    stage,
    title: score.listing.title,
    marketplace: score.listing.marketplace,
    riskGroup: score.listing.riskGroup,
    askingPriceJpy: score.listing.askingPriceJpy,
    expectedNetJpy: score.expectedNetJpy,
    expectedReturnPct: score.expectedReturnPct,
    confidence: score.confidence,
    authProbability: score.authProbability,
    cleanProbability: score.cleanProbability,
    priorityScore: score.priorityScore,
    traderAction: score.recommendation,
    summary: `${score.recommendation.toUpperCase()} | ask ${formatJpy(score.listing.askingPriceJpy)} | EV ${formatJpy(score.expectedNetJpy)} | confidence ${formatPercent(score.confidence)} | auth ${formatPercent(score.authProbability)}`,
    reasons: [...score.reasons],
    sourceUrl: score.listing.sourceUrl,
    sourceListingId: score.listing.sourceListingId,
    sourceQuery: score.listing.sourceQuery,
    matchedWatchlistId: score.listing.matchedWatchlistId,
    matchedWatchlistTitle: score.listing.matchedWatchlistTitle
  }
}

export function buildTraderReviewPacket(
  score: OpportunityScore
): TraderReviewPacket {
  const evidence: string[] = [...score.reasons]
  const imageEvidence = score.listing.imageEvidence
  const sellerSignals = score.listing.sellerSignals

  if (score.listing.hasMarketplaceAuthentication) {
    addEvidence(evidence, 'marketplace-authentication')
  }

  if (score.listing.priceSheetMatch) {
    addEvidence(evidence, 'price-sheet-match')
  }

  if (score.listing.shrinkWrapState === 'missing') {
    addEvidence(evidence, 'shrink-wrap missing')
  }

  if (score.listing.shrinkWrapState === 'present') {
    addEvidence(evidence, 'shrink-wrap present')
  }

  if (imageEvidence?.photoCount != null) {
    addEvidence(evidence, `${imageEvidence.photoCount} photos`)
  }

  if (imageEvidence?.frontVisible) {
    addEvidence(evidence, 'front visible')
  }

  if (imageEvidence?.backVisible) {
    addEvidence(evidence, 'back visible')
  }

  if (imageEvidence?.certVisible) {
    addEvidence(evidence, 'cert visible')
  }

  if (imageEvidence?.closeupsVisible) {
    addEvidence(evidence, 'closeups visible')
  }

  if (sellerSignals?.rating != null) {
    addEvidence(evidence, `seller rating ${sellerSignals.rating.toFixed(2)}`)
  }

  if (sellerSignals?.salesCount != null) {
    addEvidence(evidence, `seller sales ${sellerSignals.salesCount}`)
  }

  if (sellerSignals?.responseRate != null) {
    addEvidence(evidence, `seller response ${(sellerSignals.responseRate * 100).toFixed(0)}%`)
  }

  if (score.listing.liquidityScore != null) {
    addEvidence(evidence, `liquidity ${formatPercent(score.listing.liquidityScore)}`)
  }

  if (score.listing.conditionConfidence != null) {
    addEvidence(
      evidence,
      `condition confidence ${formatPercent(score.listing.conditionConfidence)}`
    )
  }

  if (score.photoPregrade) {
    addEvidence(evidence, `photo pregrade ${formatPhotoPregrade(score.photoPregrade)}`)
  }

  const stage = classifyOpportunityStage(score)
  const question =
    stage === 'notify'
      ? 'Confirm whether this is a real buy candidate and whether the photos support the condition.'
      : score.listing.riskGroup === 'sealed'
        ? 'Confirm authenticity, whether the factory seal or shrink wrap is present, and whether this should stay on the watch list.'
      : 'Confirm authenticity, condition, and whether this should stay on the watch list.'

  return {
    listingId: score.listing.id,
    stage,
    title: score.listing.title,
    marketplace: score.listing.marketplace,
    riskGroup: score.listing.riskGroup,
    askingPriceJpy: score.listing.askingPriceJpy,
    cleanExitJpy: score.listing.cleanExitJpy,
    damagedExitJpy: score.listing.damagedExitJpy,
    expectedNetJpy: score.expectedNetJpy,
    expectedReturnPct: score.expectedReturnPct,
    confidence: score.confidence,
    authProbability: score.authProbability,
    cleanProbability: score.cleanProbability,
    evidence,
    question,
    labelFields: [
      {
        key: 'authenticity',
        allowedValues: ['authentic', 'fake', 'uncertain'],
        guidance: 'Mark authentic only when you would buy it yourself.'
      },
      {
        key: 'condition',
        allowedValues: ['clean', 'damaged', 'uncertain'],
        guidance: 'Use damaged when the listing must exit at the damaged path.'
      },
      {
        key: 'recommendedAction',
        allowedValues: ['buy', 'watch', 'pass'],
        guidance: 'Record the actual trade decision you would make after review.'
      },
      {
        key: 'confidence',
        allowedValues: ['0-1'],
        guidance: 'Rate how sure you are about the call from 0 to 1.'
      },
      {
        key: 'realizedProfitJpy',
        allowedValues: ['integer'],
        guidance: 'Fill this after sale, even if the result is negative.'
      }
    ],
    sourceUrl: score.listing.sourceUrl,
    sourceListingId: score.listing.sourceListingId,
    sourceQuery: score.listing.sourceQuery,
    matchedWatchlistId: score.listing.matchedWatchlistId,
    matchedWatchlistTitle: score.listing.matchedWatchlistTitle
  }
}

export function formatNotificationPayload(payload: NotificationPayload): string {
  const lines = [
    `${payload.stage.toUpperCase()} ${payload.marketplace.toUpperCase()} ${payload.title}`,
    `ask ${formatJpy(payload.askingPriceJpy)} | EV ${formatJpy(payload.expectedNetJpy)} | return ${formatPercent(payload.expectedReturnPct)} | auth ${formatPercent(payload.authProbability)} | confidence ${formatPercent(payload.confidence)}`,
    payload.sourceUrl ? `link ${payload.sourceUrl}` : undefined,
    payload.sourceQuery ? `query ${payload.sourceQuery}` : undefined,
    payload.matchedWatchlistTitle ? `match ${payload.matchedWatchlistTitle}` : undefined,
    payload.reasons.length > 0 ? `why ${payload.reasons.join(', ')}` : undefined
  ].filter((line): line is string => line != null)

  return lines.join('\n')
}

export function formatTraderReviewPacket(packet: TraderReviewPacket): string {
  const lines = [
    `${packet.stage.toUpperCase()} ${packet.marketplace.toUpperCase()} ${packet.title}`,
    `ask ${formatJpy(packet.askingPriceJpy)} | clean ${formatJpy(packet.cleanExitJpy)} | damaged ${formatJpy(packet.damagedExitJpy)}`,
    `EV ${formatJpy(packet.expectedNetJpy)} | return ${formatPercent(packet.expectedReturnPct)} | auth ${formatPercent(packet.authProbability)} | clean ${formatPercent(packet.cleanProbability)} | confidence ${formatPercent(packet.confidence)}`,
    packet.sourceUrl ? `link ${packet.sourceUrl}` : undefined,
    packet.sourceQuery ? `query ${packet.sourceQuery}` : undefined,
    packet.matchedWatchlistTitle ? `match ${packet.matchedWatchlistTitle}` : undefined,
    packet.evidence.length > 0 ? `evidence ${packet.evidence.join(', ')}` : undefined,
    `question ${packet.question}`
  ].filter((line): line is string => line != null)

  return lines.join('\n')
}

export function summarizeScorePipeline(
  scores: OpportunityScore[]
): ScorePipelineSummary {
  const notifyCount = scores.filter(score => classifyOpportunityStage(score) === 'notify').length
  const reviewCount = scores.filter(score => classifyOpportunityStage(score) === 'review').length
  const passCount = scores.length - notifyCount - reviewCount

  return {
    total: scores.length,
    notifyCount,
    reviewCount,
    passCount,
    averageExpectedNetJpy: average(scores.map(score => score.expectedNetJpy)),
    averagePriorityScore: average(scores.map(score => score.priorityScore)),
    averageConfidence: average(scores.map(score => score.confidence)),
    averageAuthProbability: average(scores.map(score => score.authProbability)),
    averageCleanProbability: average(scores.map(score => score.cleanProbability))
  }
}

export function summarizeLabelFeedback(
  labels: TraderLabel[]
): LabelFeedbackSummary {
  const confidences = labels.flatMap(label =>
    label.confidence == null ? [] : [label.confidence]
  )
  const realizedProfits = labels.flatMap(label =>
    label.realizedProfitJpy == null ? [] : [label.realizedProfitJpy]
  )
  const profitableLabels = realizedProfits.filter(value => value > 0)

  return {
    totalLabels: labels.length,
    authenticCount: labels.filter(label => label.authenticity === 'authentic').length,
    fakeCount: labels.filter(label => label.authenticity === 'fake').length,
    uncertainAuthenticityCount: labels.filter(label => label.authenticity === 'uncertain').length,
    cleanCount: labels.filter(label => label.condition === 'clean').length,
    damagedCount: labels.filter(label => label.condition === 'damaged').length,
    uncertainConditionCount: labels.filter(label => label.condition === 'uncertain').length,
    buyCount: labels.filter(label => label.recommendedAction === 'buy').length,
    watchCount: labels.filter(label => label.recommendedAction === 'watch').length,
    passCount: labels.filter(label => label.recommendedAction === 'pass').length,
    averageConfidence: average(confidences),
    averageRealizedProfitJpy: average(realizedProfits),
    positiveProfitRate:
      realizedProfits.length === 0
        ? null
        : profitableLabels.length / realizedProfits.length
  }
}

export function summarizeMatchedFeedback(
  scores: OpportunityScore[],
  labels: TraderLabel[]
): MatchedLabelSummary {
  const scoresById = new Map(scores.map(score => [score.listing.id, score]))
  const matchedPairs = labels
    .map(label => ({
      label,
      score: scoresById.get(label.listingId)
    }))
    .filter((pair): pair is { label: TraderLabel; score: OpportunityScore } => pair.score != null)

  const buySignals = matchedPairs.filter(pair => pair.score.recommendation === 'buy')
  const confirmedBuys = buySignals.filter(pair => pair.label.recommendedAction === 'buy').length
  const falsePositiveCount = buySignals.length - confirmedBuys
  const realizedProfits = matchedPairs.flatMap(pair =>
    pair.label.realizedProfitJpy == null ? [] : [pair.label.realizedProfitJpy]
  )

  return {
    matchedLabels: matchedPairs.length,
    buySignals: buySignals.length,
    confirmedBuys,
    falsePositiveCount,
    precision:
      buySignals.length === 0 ? null : confirmedBuys / buySignals.length,
    falsePositiveRate:
      buySignals.length === 0 ? null : falsePositiveCount / buySignals.length,
    averageRealizedProfitJpy: average(realizedProfits)
  }
}

export function buildInfrastructureChecklist(): InfrastructureChecklist {
  return {
    requiredNow: [
      'a scheduler or worker to run the scorer on a cadence',
      'one notification sink for WhatsApp, Telegram, SMS, or dashboard alerts',
      'append-only label storage for trader feedback',
      'secret storage for API keys and webhook tokens',
      'basic audit logging for alerts and manual decisions'
    ],
    recommendedSoon: [
      'a simple review dashboard for top buy and watch candidates',
      'an approval-only cross-list draft queue for high-confidence items',
      'persistent storage beyond JSON files once multiple operators are involved',
      'a queue or job runner if listing volume rises',
      'object storage only if you start retaining listing images for OCR',
      'optional sentiment feeds from exported channel posts once backtests prove lift'
    ],
    deferUntilLater: [
      'managed OCR or vision services for image triage',
      'auto-buy execution infrastructure',
      'multi-region or high-availability database setup',
      'GPU capacity for larger vision or classification models'
    ]
  }
}

export function buildMvpReport(
  scores: OpportunityScore[],
  labels: TraderLabel[]
): MvpReport {
  return {
    pipeline: summarizeScorePipeline(scores),
    labels: summarizeLabelFeedback(labels),
    matched: summarizeMatchedFeedback(scores, labels),
    infrastructure: buildInfrastructureChecklist()
  }
}

export function formatMvpReport(report: MvpReport): string {
  return [
    'MVP REPORT',
    `pipeline=${report.pipeline.total} opportunities | notify=${report.pipeline.notifyCount} | review=${report.pipeline.reviewCount} | pass=${report.pipeline.passCount}`,
    `pipeline averages | EV=${formatOptionalJpy(report.pipeline.averageExpectedNetJpy)} | confidence=${formatOptionalPercent(report.pipeline.averageConfidence)} | priority=${report.pipeline.averagePriorityScore == null ? 'n/a' : report.pipeline.averagePriorityScore.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `labels=${report.labels.totalLabels} | authenticity=${report.labels.authenticCount}/${report.labels.fakeCount}/${report.labels.uncertainAuthenticityCount} | condition=${report.labels.cleanCount}/${report.labels.damagedCount}/${report.labels.uncertainConditionCount}`,
    `label averages | confidence=${formatOptionalPercent(report.labels.averageConfidence)} | realized profit=${formatOptionalJpy(report.labels.averageRealizedProfitJpy)} | positive-profit-rate=${formatOptionalPercent(report.labels.positiveProfitRate)}`,
    `matched=${report.matched.matchedLabels} | buy precision=${formatOptionalPercent(report.matched.precision)} | false-positive-rate=${formatOptionalPercent(report.matched.falsePositiveRate)} | avg matched profit=${formatOptionalJpy(report.matched.averageRealizedProfitJpy)}`,
    `procure now: ${report.infrastructure.requiredNow.join(', ')}`,
    `procure soon: ${report.infrastructure.recommendedSoon.join(', ')}`,
    `defer later: ${report.infrastructure.deferUntilLater.join(', ')}`
  ].join('\n')
}
