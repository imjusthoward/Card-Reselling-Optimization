import { describe, expect, it } from 'vitest'
import {
  buildInfrastructureChecklist,
  buildMvpReport,
  buildNotificationPayload,
  buildTraderReviewPacket,
  classifyOpportunityStage,
  formatMvpReport,
  summarizeLabelFeedback,
  summarizeMatchedFeedback,
  summarizeScorePipeline
} from '../src/mvp.js'
import type { OpportunityScore, TraderLabel } from '../src/types.js'

function makeScore(
  listingOverrides: Partial<OpportunityScore['listing']> = {},
  scoreOverrides: Partial<Omit<OpportunityScore, 'listing'>> = {}
): OpportunityScore {
  const listing: OpportunityScore['listing'] = {
    id: 'mercari-001',
    title: 'Pokemon JP PSA 10 Alt Art',
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
      salesCount: 120,
      responseRate: 0.98
    },
    liquidityScore: 0.9,
    conditionConfidence: 0.92,
    notes: ['Clean slab', 'Cert visible', 'Tracked price sheet match'],
    ...listingOverrides
  }

  return {
    listing,
    expectedExitJpy: 123000,
    expectedNetJpy: 16000,
    expectedReturnPct: 0.16,
    authProbability: 0.91,
    cleanProbability: 0.9,
    fakeProbability: 0.09,
    confidence: 0.84,
    priorityScore: 12000,
    recommendation: 'buy',
    reasons: ['marketplace-auth', 'price-sheet-match'],
    ...scoreOverrides
  }
}

describe('MVP workflow', () => {
  it('builds a notification payload for buy candidates', () => {
    const score = makeScore()

    expect(classifyOpportunityStage(score)).toBe('notify')

    const payload = buildNotificationPayload(score, 'whatsapp')

    expect(payload.channel).toBe('whatsapp')
    expect(payload.stage).toBe('notify')
    expect(payload.summary).toContain('EV JPY')
    expect(payload.summary).toContain('confidence 84.0%')
    expect(payload.reasons).toContain('marketplace-auth')
  })

  it('builds a trader review packet for watch candidates', () => {
    const score = makeScore(
      {
        id: 'mercari-002',
        title: 'Pokemon JP raw card too cheap',
        marketplace: 'mercari',
        riskGroup: 'raw',
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
          salesCount: 4,
          responseRate: 0.6
        },
        liquidityScore: 0.2,
        conditionConfidence: 0.35
      },
      {
        recommendation: 'watch',
        expectedNetJpy: 4000,
        expectedReturnPct: 0.13,
        authProbability: 0.68,
        cleanProbability: 0.5,
        fakeProbability: 0.32,
        confidence: 0.52,
        priorityScore: 1500,
        reasons: ['thin-photo-set', 'missing-back-photo']
      }
    )

    expect(classifyOpportunityStage(score)).toBe('review')

    const packet = buildTraderReviewPacket(score)

    expect(packet.stage).toBe('review')
    expect(packet.question).toContain('watch list')
    expect(packet.evidence).toContain('thin-photo-set')
    expect(packet.labelFields.map(field => field.key)).toEqual([
      'authenticity',
      'condition',
      'recommendedAction',
      'confidence',
      'realizedProfitJpy'
    ])
  })

  it('summarizes the pipeline and procurement needs', () => {
    const scores = [
      makeScore(
        { id: 'mercari-001', title: 'High trust slab' },
        { recommendation: 'buy', priorityScore: 15000, expectedNetJpy: 16000 }
      ),
      makeScore(
        {
          id: 'mercari-002',
          title: 'Needs manual review',
          marketplace: 'mercari'
        },
        {
          recommendation: 'watch',
          priorityScore: 3000,
          expectedNetJpy: 5000,
          confidence: 0.58,
          authProbability: 0.76,
          cleanProbability: 0.61
        }
      ),
      makeScore(
        { id: 'mercari-003', title: 'Drop this one' },
        {
          recommendation: 'pass',
          priorityScore: 0,
          expectedNetJpy: -2000,
          confidence: 0.3,
          authProbability: 0.4,
          cleanProbability: 0.35
        }
      )
    ]

    const labels: TraderLabel[] = [
      {
        listingId: 'mercari-001',
        marketplace: 'mercari',
        riskGroup: 'slab',
        authenticity: 'authentic',
        condition: 'clean',
        recommendedAction: 'buy',
        confidence: 0.96,
        realizedProfitJpy: 18000
      },
      {
        listingId: 'mercari-002',
        marketplace: 'mercari',
        riskGroup: 'raw',
        authenticity: 'fake',
        condition: 'damaged',
        recommendedAction: 'pass',
        confidence: 0.88,
        realizedProfitJpy: -12000
      }
    ]

    const pipeline = summarizeScorePipeline(scores)
    const labelSummary = summarizeLabelFeedback(labels)
    const matched = summarizeMatchedFeedback(scores, labels)
    const report = buildMvpReport(scores, labels)
    const infrastructure = buildInfrastructureChecklist()
    const formatted = formatMvpReport(report)

    expect(pipeline.notifyCount).toBe(1)
    expect(pipeline.reviewCount).toBe(1)
    expect(pipeline.passCount).toBe(1)
    expect(labelSummary.totalLabels).toBe(2)
    expect(labelSummary.fakeCount).toBe(1)
    expect(matched.matchedLabels).toBe(2)
    expect(matched.buySignals).toBe(1)
    expect(matched.precision).toBe(1)
    expect(formatted).toContain('procure now:')
    expect(formatted).toContain('buy precision=100.0%')
    expect(infrastructure.requiredNow[0]).toContain('scheduler')
  })
})
