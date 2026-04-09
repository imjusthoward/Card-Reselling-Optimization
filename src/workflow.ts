import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildCalibration,
  buildMvpReport,
  buildNotificationPayload,
  buildTraderReviewPacket,
  scoreBatch,
  type CalibrationInput,
  type NotificationChannel,
  type OpportunityListing,
  type OpportunityScore,
  type ScoringConfig,
  type TraderLabel
} from './index.js'

export const DEFAULT_LISTINGS_PATH = 'data/sample-listings.json'
export const DEFAULT_LABELS_PATH = 'data/sample-labels.json'
export const DEFAULT_CONFIG_PATH = 'data/scoring-config.json'

export interface WorkflowOptions {
  listingsPath?: string
  labelsPath?: string
  configPath?: string
  limit?: number
}

export interface LoadedWorkflow {
  listings: OpportunityListing[]
  labels: TraderLabel[]
  scoringConfig: Partial<ScoringConfig & CalibrationInput>
  calibration: ReturnType<typeof buildCalibration>
  scores: OpportunityScore[]
  limitedScores: OpportunityScore[]
  report: ReturnType<typeof buildMvpReport>
}

export interface WorkflowOutputs {
  notifications: ReturnType<typeof buildNotificationPayload>[]
  reviews: ReturnType<typeof buildTraderReviewPacket>[]
}

export function resolveWorkflowPath(
  candidate: string | undefined,
  fallback: string
): string {
  return candidate?.trim() ? candidate : fallback
}

export async function loadJson<T>(filePath: string): Promise<T> {
  const absolutePath = resolve(process.cwd(), filePath)

  if (!existsSync(absolutePath)) {
    throw new Error(`Missing file: ${absolutePath}`)
  }

  const contents = await readFile(absolutePath, 'utf8')
  return JSON.parse(contents) as T
}

export async function loadWorkflow(
  options: WorkflowOptions = {}
): Promise<LoadedWorkflow> {
  const listingsPath = resolveWorkflowPath(options.listingsPath, DEFAULT_LISTINGS_PATH)
  const labelsPath = resolveWorkflowPath(options.labelsPath, DEFAULT_LABELS_PATH)
  const configPath = resolveWorkflowPath(options.configPath, DEFAULT_CONFIG_PATH)

  const listings = await loadJson<OpportunityListing[]>(listingsPath)
  const labels = await loadJson<TraderLabel[]>(labelsPath)
  const scoringConfig = await loadJson<Partial<ScoringConfig & CalibrationInput>>(configPath)

  const calibration = buildCalibration(labels, scoringConfig)
  const scores = scoreBatch(listings, calibration, scoringConfig)
  const limitedScores =
    options.limit == null ? scores : scores.slice(0, options.limit)

  return {
    listings,
    labels,
    scoringConfig,
    calibration,
    scores,
    limitedScores,
    report: buildMvpReport(limitedScores, labels)
  }
}

export function buildWorkflowOutputs(
  scores: OpportunityScore[],
  channel: NotificationChannel = 'dashboard'
): WorkflowOutputs {
  const notifications = scores
    .filter(score => score.recommendation === 'buy')
    .map(score => buildNotificationPayload(score, channel))
  const reviews = scores
    .filter(score => score.recommendation !== 'pass')
    .map(score => buildTraderReviewPacket(score))

  return {
    notifications,
    reviews
  }
}
