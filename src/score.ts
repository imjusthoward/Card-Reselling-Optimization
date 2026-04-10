import {
  getCalibrationBucket
} from './calibration.js'
import { buildSentimentAdjustment } from './sentiment.js'
import { estimatePhotoPregrade } from './pregrader.js'
import {
  type CalibrationProfile,
  type FeedbackSignalSummary,
  type OpportunityListing,
  type OpportunityScore,
  type Recommendation,
  type SentimentSummary,
  type ScoringConfig
} from './types.js'

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  minExpectedNetJpy: 5000,
  minExpectedReturnPct: 0.1,
  minLiquidityScore: 0.45,
  minConfidence: 0.55,
  minAuthProbability: 0.75,
  maxFakeProbability: 0.25,
  defaultExitCostsJpy: 0,
  defaultSalvageRate: 0.15,
  suspiciousUnderpriceRatio: 0.45
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value)
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

function computeSellerAdjustment(listing: OpportunityListing): number {
  const rating = listing.sellerSignals?.rating

  if (rating == null) {
    return 0
  }

  if (rating >= 4.95) {
    return 0.08
  }

  if (rating >= 4.8) {
    return 0.04
  }

  if (rating <= 4.4) {
    return -0.08
  }

  if (rating <= 4.6) {
    return -0.04
  }

  return 0
}

function computeFeedbackAdjustment(
  listing: OpportunityListing,
  feedbackSignals?: FeedbackSignalSummary
): { authDelta: number; cleanDelta: number; reasons: string[] } {
  const reasons: string[] = []
  let authDelta = 0
  let cleanDelta = 0

  if (!feedbackSignals || feedbackSignals.totalLabels <= 0) {
    return { authDelta, cleanDelta, reasons }
  }

  const sealedListing = listing.riskGroup === 'sealed'
  const missingSellerSignals = listing.sellerSignals?.rating == null && listing.sellerSignals?.salesCount == null
  const missingPhotoEvidence = (listing.imageEvidence?.photoCount ?? 0) <= 1

  if (sealedListing && feedbackSignals.sealMissingCount > 0) {
    const penalty = Math.min(0.12, feedbackSignals.sealMissingCount * 0.02)
    cleanDelta -= penalty
    addReason(reasons, 'feedback-shrinkless-pattern')
  }

  if (missingSellerSignals && feedbackSignals.sellerRiskCount > 0) {
    const penalty = Math.min(0.11, feedbackSignals.sellerRiskCount * 0.02)
    authDelta -= penalty
    addReason(reasons, 'feedback-seller-risk')
  }

  if (sealedListing && feedbackSignals.packMismatchCount > 0) {
    const penalty = Math.min(0.1, feedbackSignals.packMismatchCount * 0.02)
    authDelta -= penalty
    cleanDelta -= penalty * 0.5
    addReason(reasons, 'feedback-pack-mismatch')
  }

  if (missingPhotoEvidence && feedbackSignals.photoRiskCount > 0) {
    const penalty = Math.min(0.08, feedbackSignals.photoRiskCount * 0.015)
    authDelta -= penalty
    cleanDelta -= penalty
    addReason(reasons, 'feedback-photo-risk')
  }

  if (feedbackSignals.conditionMismatchCount > 0) {
    const penalty = Math.min(0.08, feedbackSignals.conditionMismatchCount * 0.015)
    cleanDelta -= penalty
    addReason(reasons, 'feedback-condition-mismatch')
  }

  return { authDelta, cleanDelta, reasons }
}

function imageEvidenceAdjustment(
  listing: OpportunityListing
): { authDelta: number; cleanDelta: number; reasons: string[] } {
  const reasons: string[] = []
  let authDelta = 0
  let cleanDelta = 0
  const evidence = listing.imageEvidence

  if (!evidence) {
    return { authDelta, cleanDelta, reasons }
  }

  if ((evidence.photoCount ?? 0) >= 4) {
    authDelta += 0.04
    cleanDelta += 0.04
    addReason(reasons, 'strong-photo-set')
  }

  if (evidence.frontVisible && evidence.backVisible) {
    authDelta += 0.05
    cleanDelta += 0.08
    addReason(reasons, 'front-and-back-visible')
  }

  if (evidence.certVisible && listing.riskGroup === 'slab') {
    authDelta += 0.12
    addReason(reasons, 'cert-visible')
  }

  if ((evidence.photoCount ?? 0) <= 1) {
    authDelta -= 0.12
    cleanDelta -= 0.1
    addReason(reasons, 'thin-photo-set')
  }

  if (!evidence.backVisible && listing.riskGroup !== 'sealed') {
    cleanDelta -= 0.12
    addReason(reasons, 'missing-back-photo')
  }

  return { authDelta, cleanDelta, reasons }
}

function shrinkWrapAdjustment(
  listing: OpportunityListing
): { cleanDelta: number; reasons: string[] } {
  const reasons: string[] = []
  let cleanDelta = 0

  if (listing.riskGroup !== 'sealed') {
    return { cleanDelta, reasons }
  }

  if (listing.shrinkWrapState === 'missing') {
    cleanDelta -= 0.22
    addReason(reasons, 'shrink-wrap-missing')
  } else if (listing.shrinkWrapState === 'present') {
    cleanDelta += 0.06
    addReason(reasons, 'shrink-wrap-present')
  }

  return { cleanDelta, reasons }
}

function photoPregradeAdjustment(
  photoPregrade: ReturnType<typeof estimatePhotoPregrade>
): { authDelta: number; cleanDelta: number; confidenceDelta: number; reasons: string[] } {
  const reasons: string[] = []
  const combined = photoPregrade.centeringScore * 0.55 + photoPregrade.photoQualityScore * 0.45
  let authDelta = 0
  let cleanDelta = 0
  let confidenceDelta = 0

  if (combined >= 0.85) {
    authDelta += 0.05
    cleanDelta += 0.08
    confidenceDelta += 0.04
    addReason(reasons, 'photo-pregrade-strong')
  } else if (combined >= 0.7) {
    authDelta += 0.02
    cleanDelta += 0.04
    confidenceDelta += 0.02
    addReason(reasons, 'photo-pregrade-good')
  } else if (combined <= 0.45) {
    authDelta -= 0.08
    cleanDelta -= 0.1
    confidenceDelta -= 0.05
    addReason(reasons, 'photo-pregrade-weak')
  } else if (combined <= 0.55) {
    authDelta -= 0.03
    cleanDelta -= 0.04
    confidenceDelta -= 0.02
    addReason(reasons, 'photo-pregrade-borderline')
  }

  return { authDelta, cleanDelta, confidenceDelta, reasons }
}

export function scoreOpportunity(
  listing: OpportunityListing,
  calibration: CalibrationProfile,
  config: Partial<ScoringConfig> = {},
  feedbackSignals?: FeedbackSignalSummary,
  sentimentSummary?: SentimentSummary
): OpportunityScore {
  const scoringConfig = { ...DEFAULT_SCORING_CONFIG, ...config }
  const bucket = getCalibrationBucket(
    calibration,
    listing.marketplace,
    listing.riskGroup
  )

  const reasons: string[] = []
  let authProbability = bucket.authenticity.probability
  let cleanProbability = bucket.cleanCondition.probability

  if (listing.hasMarketplaceAuthentication) {
    authProbability += 0.18
    addReason(reasons, 'marketplace-auth')
  }

  if (listing.priceSheetMatch) {
    authProbability += 0.08
    addReason(reasons, 'price-sheet-match')
  }

  const imageAdjustment = imageEvidenceAdjustment(listing)
  authProbability += imageAdjustment.authDelta
  cleanProbability += imageAdjustment.cleanDelta
  reasons.push(...imageAdjustment.reasons)

  const photoPregrade = estimatePhotoPregrade(listing)
  const pregradeAdjustment = photoPregradeAdjustment(photoPregrade)
  authProbability += pregradeAdjustment.authDelta
  cleanProbability += pregradeAdjustment.cleanDelta
  reasons.push(...pregradeAdjustment.reasons)

  const shrinkWrap = shrinkWrapAdjustment(listing)
  cleanProbability += shrinkWrap.cleanDelta
  reasons.push(...shrinkWrap.reasons)

  authProbability += computeSellerAdjustment(listing)

  const feedbackAdjustment = computeFeedbackAdjustment(listing, feedbackSignals)
  authProbability += feedbackAdjustment.authDelta
  cleanProbability += feedbackAdjustment.cleanDelta
  reasons.push(...feedbackAdjustment.reasons)

  const sentimentAdjustment = buildSentimentAdjustment(listing, sentimentSummary)
  reasons.push(...sentimentAdjustment.reasons)

  const liquidityScore = clamp(listing.liquidityScore ?? 0.5, 0, 1)
  const conditionConfidence = listing.conditionConfidence
  if (conditionConfidence != null) {
    cleanProbability += (conditionConfidence - 0.5) * 0.3
  }

  const underpriceRatio =
    listing.cleanExitJpy > 0
      ? listing.askingPriceJpy / listing.cleanExitJpy
      : 1

  if (underpriceRatio < scoringConfig.suspiciousUnderpriceRatio) {
    authProbability -= 0.25
    addReason(reasons, 'suspicious-underprice')
  } else if (underpriceRatio < 0.75) {
    authProbability -= 0.08
    addReason(reasons, 'aggressive-discount')
  }

  if (liquidityScore < scoringConfig.minLiquidityScore) {
    addReason(reasons, 'low-liquidity')
  }

  authProbability = clamp(authProbability, 0.01, 0.99)
  cleanProbability = clamp(cleanProbability, 0.01, 0.99)

  const fakeProbability = 1 - authProbability
  const damagedProbability = 1 - cleanProbability
  const exitCostsJpy = listing.exitCostsJpy ?? scoringConfig.defaultExitCostsJpy
  const salvageJpy =
    listing.salvageJpy ??
    round(listing.askingPriceJpy * scoringConfig.defaultSalvageRate)

  const authenticatedExitJpy =
    cleanProbability * listing.cleanExitJpy +
    damagedProbability * listing.damagedExitJpy
  const expectedExitJpy =
    authProbability * authenticatedExitJpy + fakeProbability * salvageJpy
  const expectedNetJpy = expectedExitJpy - listing.askingPriceJpy - exitCostsJpy
  const expectedReturnPct = expectedNetJpy / Math.max(1, listing.askingPriceJpy)

  const confidence = clamp(
    authProbability * 0.46 +
      cleanProbability * 0.3 +
      liquidityScore * 0.18 +
      (listing.hasMarketplaceAuthentication ? 0.03 : 0) +
      (listing.priceSheetMatch ? 0.03 : 0) +
      pregradeAdjustment.confidenceDelta,
    0,
    1
  )
  const priorityScore =
    Math.max(0, expectedNetJpy) *
    confidence *
    authProbability *
    liquidityScore *
    sentimentAdjustment.priorityMultiplier

  if (expectedNetJpy > 0) {
    addReason(reasons, 'positive-ev')
  } else {
    addReason(reasons, 'negative-ev')
  }

  let recommendation: Recommendation = 'pass'

  const buyQualified =
    expectedNetJpy >= scoringConfig.minExpectedNetJpy &&
    expectedReturnPct >= scoringConfig.minExpectedReturnPct &&
    confidence >= scoringConfig.minConfidence &&
    authProbability >= scoringConfig.minAuthProbability &&
    fakeProbability <= scoringConfig.maxFakeProbability &&
    liquidityScore >= scoringConfig.minLiquidityScore

  if (buyQualified) {
    recommendation = 'buy'
  } else if (expectedNetJpy > 0 && confidence >= scoringConfig.minConfidence * 0.85) {
    recommendation = 'watch'
  }

  return {
    listing,
    expectedExitJpy,
    expectedNetJpy,
    expectedReturnPct,
    authProbability,
    cleanProbability,
    fakeProbability,
    confidence,
    priorityScore,
    recommendation,
    reasons,
    photoPregrade
  }
}

export function scoreBatch(
  listings: OpportunityListing[],
  calibration: CalibrationProfile,
  config: Partial<ScoringConfig> = {},
  feedbackSignals?: FeedbackSignalSummary,
  sentimentSummary?: SentimentSummary
): OpportunityScore[] {
  return listings
    .map(listing => scoreOpportunity(listing, calibration, config, feedbackSignals, sentimentSummary))
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        right.expectedNetJpy - left.expectedNetJpy
    )
}

export function formatOpportunitySummary(score: OpportunityScore): string {
  const { listing } = score

  return [
    `${score.recommendation.toUpperCase()}: ${listing.title}`,
    `market=${listing.marketplace}`,
    `risk=${listing.riskGroup}`,
    `asking=JPY ${listing.askingPriceJpy.toLocaleString('en-US')}`,
    `ev=JPY ${score.expectedNetJpy.toLocaleString('en-US')}`,
    `return=${formatRatio(score.expectedReturnPct)}`,
    `auth=${formatRatio(score.authProbability)}`,
    `clean=${formatRatio(score.cleanProbability)}`,
    `confidence=${formatRatio(score.confidence)}`,
    `priority=${score.priorityScore.toLocaleString('en-US', {
      maximumFractionDigits: 0
    })}`,
    `reasons=${score.reasons.join(', ')}`
  ].join(' | ')
}
