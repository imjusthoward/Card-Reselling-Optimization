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

export const SHRINK_WRAP_STATES = ['present', 'missing', 'unknown'] as const

export type ShrinkWrapState = (typeof SHRINK_WRAP_STATES)[number]

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
  shrinkWrapState?: ShrinkWrapState
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
  sourceUrl?: string
  sourceListingId?: string
  sourceQuery?: string
  matchedWatchlistId?: string
  matchedWatchlistTitle?: string
  scrapedAt?: string
  imageUrls?: string[]
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
  sourceUrl?: string
  sourceListingId?: string
  sourceQuery?: string
  reviewer?: string
  reviewedAt?: string
  followUp?: string
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

export interface FeedbackSignalSummary {
  totalLabels: number
  sealMissingCount: number
  sellerRiskCount: number
  packMismatchCount: number
  photoRiskCount: number
  conditionMismatchCount: number
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

export interface WatchlistEntry {
  id: string
  title: string
  marketplaces: Marketplace[]
  searchTerms: string[]
  riskGroup: RiskGroup
  cleanExitJpy: number
  damagedExitJpy: number
  exitCostsJpy?: number
  salvageJpy?: number
  liquidityScore?: number
  hasMarketplaceAuthentication?: boolean
  priceSheetMatch?: boolean
  notes?: string[]
  active?: boolean
}

export interface ScrapedListing {
  marketplace: Marketplace
  sourceUrl: string
  sourceListingId: string
  sourceQuery?: string
  title: string
  askingPriceJpy: number
  imageUrl?: string
  sellerId?: string
  sellerRating?: number
  sellerSalesCount?: number
  sellerResponseRate?: number
  likeCount?: number
  isPriceDown?: boolean
  notes?: string[]
}
