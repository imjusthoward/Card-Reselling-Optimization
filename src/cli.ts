#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCalibration,
  formatOpportunitySummary,
  scoreBatch,
  type CalibrationInput,
  type OpportunityListing,
  type ScoringConfig,
  type TraderLabel
} from './index.js'

interface CliOptions {
  listingsPath: string
  labelsPath?: string
  configPath?: string
  output: 'table' | 'json'
  limit?: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    listingsPath: 'data/sample-listings.json',
    labelsPath: 'data/sample-labels.json',
    configPath: 'data/scoring-config.json',
    output: 'table'
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = argv[index + 1]

    switch (argument) {
      case '--listings':
        if (!next) throw new Error('Missing value for --listings')
        options.listingsPath = next
        index += 1
        break
      case '--labels':
        if (!next) throw new Error('Missing value for --labels')
        options.labelsPath = next
        index += 1
        break
      case '--config':
        if (!next) throw new Error('Missing value for --config')
        options.configPath = next
        index += 1
        break
      case '--output':
        if (!next) throw new Error('Missing value for --output')
        if (next !== 'table' && next !== 'json') {
          throw new Error('Output must be either "table" or "json"')
        }
        options.output = next
        index += 1
        break
      case '--limit':
        if (!next) throw new Error('Missing value for --limit')
        options.limit = Number(next)
        index += 1
        break
      default:
        break
    }
  }

  return options
}

async function loadJson<T>(filePath: string): Promise<T> {
  const absolutePath = resolve(process.cwd(), filePath)

  if (!existsSync(absolutePath)) {
    throw new Error(`Missing file: ${absolutePath}`)
  }

  const contents = await readFile(absolutePath, 'utf8')
  return JSON.parse(contents) as T
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const listings = await loadJson<OpportunityListing[]>(options.listingsPath)
  const labels = options.labelsPath
    ? await loadJson<TraderLabel[]>(options.labelsPath)
    : []
  const scoringConfig = options.configPath
    ? await loadJson<Partial<ScoringConfig & CalibrationInput>>(
        options.configPath
      )
    : {}

  const calibration = buildCalibration(labels, scoringConfig)
  const scores = scoreBatch(listings, calibration, scoringConfig)
  const limitedScores =
    options.limit == null ? scores : scores.slice(0, options.limit)

  if (options.output === 'json') {
    process.stdout.write(`${JSON.stringify(limitedScores, null, 2)}\n`)
    return
  }

  for (const score of limitedScores) {
    console.log(formatOpportunitySummary(score))
  }
}

main().catch(error => {
  console.error((error as Error).message)
  process.exitCode = 1
})

