import { describe, expect, it } from 'vitest'
import { buildCalibration, calibrationKey } from '../src/calibration.js'
import type { TraderLabel } from '../src/types.js'

function makeLabel(overrides: Partial<TraderLabel>): TraderLabel {
  return {
    listingId: 'listing-1',
    marketplace: 'mercari',
    riskGroup: 'raw',
    authenticity: 'authentic',
    condition: 'clean',
    ...overrides
  }
}

describe('buildCalibration', () => {
  it('creates stronger priors for buckets with more trader-confirmed wins', () => {
    const labels: TraderLabel[] = [
      makeLabel({ listingId: 'a', authenticity: 'authentic', condition: 'clean' }),
      makeLabel({ listingId: 'b', authenticity: 'authentic', condition: 'clean' }),
      makeLabel({
        listingId: 'c',
        authenticity: 'fake',
        condition: 'damaged',
        marketplace: 'yahoo_flea'
      })
    ]

    const calibration = buildCalibration(labels, {
      authenticityPriorProbability: 0.85,
      cleanConditionPriorProbability: 0.7,
      priorStrength: 4
    })

    const mercariBucket = calibration.byKey[calibrationKey('mercari', 'raw')]

    expect(mercariBucket.authenticity.probability).toBeGreaterThan(
      calibration.overall.authenticity.probability
    )
    expect(mercariBucket.cleanCondition.probability).toBeGreaterThan(
      calibration.overall.cleanCondition.probability
    )
    expect(calibration.overall.authenticity.sampleSize).toBe(3)
  })
})

