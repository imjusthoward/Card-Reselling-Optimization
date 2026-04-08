import {
  type CalibrationBucket,
  type CalibrationInput,
  type CalibrationProfile,
  type ConditionLabel,
  type Marketplace,
  type ProbabilityEstimate,
  type RiskGroup,
  type TraderLabel
} from './types.js'

const DEFAULT_PRIOR_STRENGTH = 6
const DEFAULT_AUTHENTICITY_PRIOR = 0.9
const DEFAULT_CONDITION_PRIOR = 0.75

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function derivePriorCounts(probability: number, priorStrength: number): {
  successes: number
  failures: number
} {
  const boundedProbability = clamp(probability, 0.01, 0.99)
  const boundedStrength = Math.max(0, priorStrength)

  return {
    successes: boundedProbability * boundedStrength,
    failures: (1 - boundedProbability) * boundedStrength
  }
}

function estimateProbability(
  successes: number,
  failures: number,
  priorProbability: number,
  priorStrength: number
): ProbabilityEstimate {
  const prior = derivePriorCounts(priorProbability, priorStrength)
  const totalSuccesses = prior.successes + successes
  const totalFailures = prior.failures + failures
  const sampleSize = successes + failures

  return {
    probability: clamp(
      totalSuccesses / Math.max(1, totalSuccesses + totalFailures),
      0.01,
      0.99
    ),
    successes,
    failures,
    sampleSize
  }
}

function createEmptyBucket(): {
  authenticitySuccesses: number
  authenticityFailures: number
  cleanSuccesses: number
  cleanFailures: number
} {
  return {
    authenticitySuccesses: 0,
    authenticityFailures: 0,
    cleanSuccesses: 0,
    cleanFailures: 0
  }
}

export function calibrationKey(
  marketplace: Marketplace,
  riskGroup: RiskGroup
): string {
  return `${marketplace}:${riskGroup}`
}

export function buildCalibration(
  labels: TraderLabel[],
  input: CalibrationInput = {}
): CalibrationProfile {
  const priorStrength = input.priorStrength ?? DEFAULT_PRIOR_STRENGTH
  const authenticityPrior =
    input.authenticityPriorProbability ?? DEFAULT_AUTHENTICITY_PRIOR
  const conditionPrior =
    input.cleanConditionPriorProbability ?? DEFAULT_CONDITION_PRIOR

  const overall = createEmptyBucket()
  const byKeyRaw: Record<string, ReturnType<typeof createEmptyBucket>> = {}

  for (const label of labels) {
    const key = calibrationKey(label.marketplace, label.riskGroup)
    byKeyRaw[key] ??= createEmptyBucket()

    if (label.authenticity === 'authentic') {
      overall.authenticitySuccesses += 1
      byKeyRaw[key].authenticitySuccesses += 1
    } else if (label.authenticity === 'fake') {
      overall.authenticityFailures += 1
      byKeyRaw[key].authenticityFailures += 1
    }

    if (label.condition === 'clean') {
      overall.cleanSuccesses += 1
      byKeyRaw[key].cleanSuccesses += 1
    } else if (label.condition === 'damaged') {
      overall.cleanFailures += 1
      byKeyRaw[key].cleanFailures += 1
    }
  }

  const convertBucket = (
    bucket: ReturnType<typeof createEmptyBucket>
  ): CalibrationBucket => ({
    authenticity: estimateProbability(
      bucket.authenticitySuccesses,
      bucket.authenticityFailures,
      authenticityPrior,
      priorStrength
    ),
    cleanCondition: estimateProbability(
      bucket.cleanSuccesses,
      bucket.cleanFailures,
      conditionPrior,
      priorStrength
    )
  })

  const byKey: Record<string, CalibrationBucket> = {}

  for (const [key, bucket] of Object.entries(byKeyRaw)) {
    byKey[key] = convertBucket(bucket)
  }

  return {
    overall: convertBucket(overall),
    byKey
  }
}

export function getCalibrationBucket(
  calibration: CalibrationProfile,
  marketplace: Marketplace,
  riskGroup: RiskGroup
): CalibrationBucket {
  return (
    calibration.byKey[calibrationKey(marketplace, riskGroup)] ??
    calibration.overall
  )
}

