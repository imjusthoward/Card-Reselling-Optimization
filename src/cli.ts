#!/usr/bin/env node
import {
  formatMvpReport,
  NOTIFICATION_CHANNELS,
  formatOpportunitySummary,
  type NotificationChannel
} from './index.js'
import {
  buildWorkflowOutputs,
  loadWorkflow,
  resolveWorkflowPath,
  DEFAULT_CONFIG_PATH,
  DEFAULT_LABELS_PATH,
  DEFAULT_LISTINGS_PATH
} from './workflow.js'

interface CliOptions {
  listingsPath: string
  labelsPath?: string
  configPath?: string
  output: 'table' | 'json' | 'notify' | 'review' | 'summary'
  channel: NotificationChannel
  limit?: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    listingsPath: 'data/sample-listings.json',
    labelsPath: 'data/sample-labels.json',
    configPath: 'data/scoring-config.json',
    output: 'table',
    channel: 'dashboard'
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
        if (
          next !== 'table' &&
          next !== 'json' &&
          next !== 'notify' &&
          next !== 'review' &&
          next !== 'summary'
        ) {
          throw new Error('Output must be one of table, json, notify, review, or summary')
        }
        options.output = next
        index += 1
        break
      case '--channel':
        if (!next) throw new Error('Missing value for --channel')
        if (!NOTIFICATION_CHANNELS.includes(next as NotificationChannel)) {
          throw new Error(
            `Channel must be one of ${NOTIFICATION_CHANNELS.join(', ')}`
          )
        }
        options.channel = next as NotificationChannel
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

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const workflow = await loadWorkflow({
    listingsPath: resolveWorkflowPath(options.listingsPath, DEFAULT_LISTINGS_PATH),
    labelsPath:
      options.labelsPath == null
        ? DEFAULT_LABELS_PATH
        : resolveWorkflowPath(options.labelsPath, DEFAULT_LABELS_PATH),
    configPath:
      options.configPath == null
        ? DEFAULT_CONFIG_PATH
        : resolveWorkflowPath(options.configPath, DEFAULT_CONFIG_PATH),
    limit: options.limit
  })
  const { limitedScores } = workflow

  if (options.output === 'json') {
    process.stdout.write(`${JSON.stringify(limitedScores, null, 2)}\n`)
    return
  }

  if (options.output === 'notify') {
    const { notifications: notificationPayloads } = buildWorkflowOutputs(
      limitedScores,
      options.channel
    )
    process.stdout.write(`${JSON.stringify(notificationPayloads, null, 2)}\n`)
    return
  }

  if (options.output === 'review') {
    const { reviews: reviewPackets } = buildWorkflowOutputs(
      limitedScores,
      options.channel
    )
    process.stdout.write(`${JSON.stringify(reviewPackets, null, 2)}\n`)
    return
  }

  if (options.output === 'summary') {
    console.log(formatMvpReport(workflow.report))
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
