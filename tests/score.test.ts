import { describe, expect, it } from 'vitest'
import { buildCalibration } from '../src/calibration.js'
import {
  DEFAULT_SCORING_CONFIG,
  formatOpportunitySummary,
  scoreBatch,
  scoreOpportunity
} from '../src/score.js'
import type { OpportunityListing, TraderLabel } from '../src/types.js'

const calibrationLabels: TraderLabel[] = [
  {
    listingId: 'train-1',
    marketplace: 'mercari',
    riskGroup: 'raw',
    authenticity: 'authentic',
    condition: 'clean'
  },
  {
    listingId: 'train-2',
    marketplace: 'mercari',
    riskGroup: 'raw',
    authenticity: 'authentic',
    condition: 'clean'
  },
  {
    listingId: 'train-3',
    marketplace: 'mercari',
    riskGroup: 'raw',
    authenticity: 'authentic',
    condition: 'clean'
  },
  {
    listingId: 'train-4',
    marketplace: 'mercari',
    riskGroup: 'raw',
    authenticity: 'fake',
    condition: 'damaged'
  }
]

const calibration = buildCalibration(calibrationLabels)

function makeListing(overrides: Partial<OpportunityListing>): OpportunityListing {
  return {
    id: 'listing-1',
    title: 'Pokemon JP Alt Art PSA 10',
    marketplace: 'mercari',
    riskGroup: 'slab',
    askingPriceJpy: 100000,
    cleanExitJpy: 130000,
    damagedExitJpy: 105000,
    exitCostsJpy: 7000,
    salvageJpy: 15000,
    hasMarketplaceAuthentication: true,
    priceSheetMatch: true,
    imageEvidence: {
      photoCount: 5,
      frontVisible: true,
      backVisible: true,
      certVisible: true
    },
    sellerSignals: {
      rating: 4.98,
      salesCount: 120
    },
    liquidityScore: 0.88,
    conditionConfidence: 0.9,
    ...overrides
  }
}

describe('scoreOpportunity', () => {
  it('buys a high-confidence, high-EV opportunity', () => {
    const score = scoreOpportunity(makeListing({}), calibration)

    expect(score.recommendation).toBe('buy')
    expect(score.expectedNetJpy).toBeGreaterThan(
      DEFAULT_SCORING_CONFIG.minExpectedNetJpy
    )
    expect(score.reasons).toContain('marketplace-auth')
    expect(score.reasons).toContain('price-sheet-match')
    expect(formatOpportunitySummary(score)).toContain('BUY:')
  })

  it('rejects a suspicious underpriced listing with weak evidence', () => {
    const score = scoreOpportunity(
      makeListing({
        askingPriceJpy: 30000,
        cleanExitJpy: 300000,
        damagedExitJpy: 240000,
        hasMarketplaceAuthentication: false,
        priceSheetMatch: false,
        imageEvidence: {
          photoCount: 1,
          frontVisible: true,
          backVisible: false,
          certVisible: false
        },
        sellerSignals: {
          rating: 4.1,
          salesCount: 4
        },
        liquidityScore: 0.2,
        conditionConfidence: 0.35
      }),
      calibration,
      {
        minExpectedNetJpy: 5000,
        minExpectedReturnPct: 0.1
      }
    )

    expect(score.recommendation).toBe('pass')
    expect(score.reasons).toContain('suspicious-underprice')
    expect(score.reasons).toContain('thin-photo-set')
    expect(score.reasons).toContain('missing-back-photo')
    expect(score.fakeProbability).toBeGreaterThan(0.2)
  })

  it('sorts the highest priority opportunity first', () => {
    const listings: OpportunityListing[] = [
      makeListing({
        id: '1',
        title: 'Reliable spread',
        askingPriceJpy: 120000,
        cleanExitJpy: 150000,
        damagedExitJpy: 110000,
        liquidityScore: 0.9
      }),
      makeListing({
        id: '2',
        title: 'Thin but profitable',
        askingPriceJpy: 90000,
        cleanExitJpy: 115000,
        damagedExitJpy: 100000,
        liquidityScore: 0.85
      })
    ]

    const scores = scoreBatch(listings, calibration)

    expect(scores[0].priorityScore).toBeGreaterThanOrEqual(
      scores[1].priorityScore
    )
  })
})
