export const MARKETPLACES = [
  'mercari',
  'yahoo_flea',
  'yahoo_auction',
  'snkrdunk',
  'other'
] as const

export type Marketplace = (typeof MARKETPLACES)[number]

export const RISK_GROUPS = ['raw', 'slab', 'sealed'] as const

export type RiskGroup = (typeof RISK_GROUPS)[number]

export type AuthenticityLabel = 'authentic' | 'fake' | 'uncertain'

export type ConditionLabel = 'clean' | 'damaged' | 'uncertain'

export type Recommendation = 'buy' | 'watch' | 'pass'

export interface ListingImageEvidence {
  photoCount?: number
  frontVisible?: boolean
  backVisible?: boolean
  certVisible?: boolean
  closeupsVisible?: boolean
}

export interface SellerSignals {
  rating?: number
  salesCount?: number
  responseRate?: number
}

export interface OpportunityListing {
  id: string
  title: string
  marketplace: Marketplace
  riskGroup: RiskGroup
  askingPriceJpy: number
  cleanExitJpy: number
  damagedExitJpy: number
  exitCostsJpy?: number
  salvageJpy?: number
  hasMarketplaceAuthentication?: boolean
  priceSheetMatch?: boolean
  imageEvidence?: ListingImageEvidence
  sellerSignals?: SellerSignals
  liquidityScore?: number
  conditionConfidence?: number
  notes?: string[]
}

export interface TraderLabel {
  listingId: string
  marketplace: Marketplace
  riskGroup: RiskGroup
  authenticity: AuthenticityLabel
  condition: ConditionLabel
  recommendedAction?: Recommendation
  realizedProfitJpy?: number
  confidence?: number
  notes?: string
}

export interface CalibrationInput {
  authenticityPriorProbability?: number
  cleanConditionPriorProbability?: number
  priorStrength?: number
}

export interface ProbabilityEstimate {
  probability: number
  successes: number
  failures: number
  sampleSize: number
}

export interface CalibrationBucket {
  authenticity: ProbabilityEstimate
  cleanCondition: ProbabilityEstimate
}

export interface CalibrationProfile {
  overall: CalibrationBucket
  byKey: Record<string, CalibrationBucket>
}

export interface ScoringConfig {
  minExpectedNetJpy: number
  minExpectedReturnPct: number
  minLiquidityScore: number
  minConfidence: number
  minAuthProbability: number
  maxFakeProbability: number
  defaultExitCostsJpy: number
  defaultSalvageRate: number
  suspiciousUnderpriceRatio: number
}

export interface OpportunityScore {
  listing: OpportunityListing
  expectedExitJpy: number
  expectedNetJpy: number
  expectedReturnPct: number
  authProbability: number
  cleanProbability: number
  fakeProbability: number
  confidence: number
  priorityScore: number
  recommendation: Recommendation
  reasons: string[]
}
