import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadLiveState,
  parseMarketplaceSearchPage,
  runLiveScan,
  saveLiveState,
  selectFreshAlerts,
  type LiveMarketplace
} from '../src/live.js'
import type { ArtifactStore } from '../src/artifacts.js'
import type { LiveScanResult, LiveState } from '../src/live.js'
type TempWatchlistEntry = {
  id: string
  title: string
  marketplaces: LiveMarketplace[]
  searchTerms: string[]
  riskGroup: 'raw' | 'slab' | 'sealed'
  cleanExitJpy: number
  damagedExitJpy: number
  exitCostsJpy: number
  salvageJpy: number
  liquidityScore: number
  active: boolean
}

class MemoryArtifactStore implements ArtifactStore {
  private readonly files = new Map<string, unknown>()

  async writeJson(path: string, value: unknown): Promise<void> {
    this.files.set(path, structuredClone(value))
  }

  async readJson<T>(path: string): Promise<T | null> {
    return this.files.has(path) ? (structuredClone(this.files.get(path)) as T) : null
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter(key => key.startsWith(prefix)).sort()
  }
}

const yahooHtml = `
  <html>
    <body>
      <a href="/item/z12345" data-cl-params="sellerid:p111;price:18000;">
        <img alt="テラスタルフェスex ボックス" src="https://example.com/yahoo.jpg" />
        <p>18,000<!-- -->円</p>
      </a>
    </body>
  </html>
`

const snkrdunkHtml = `
  <html>
    <body>
      <a class="productTile" href="https://snkrdunk.com/apparels/424297" aria-label="テラスタルフェスex ボックス - ¥17,500">
        <img src="https://example.com/snkr.jpg" alt="テラスタルフェスex ボックス" />
      </a>
    </body>
  </html>
`

const shrinkMissingYahooHtml = `
  <html>
    <body>
      <a href="/item/z54321" data-cl-params="sellerid:p222;price:12800;">
        <img alt="テラスタルフェスex ボックス シュリンクなし" src="https://example.com/yahoo-shrinkless.jpg" />
        <p>12,800<!-- -->円</p>
      </a>
    </body>
  </html>
`

function makeFetch(options: { yahooHtml?: string; snkrdunkHtml?: string } = {}): typeof fetch {
  const yahooMarkup = options.yahooHtml ?? yahooHtml
  const snkrMarkup = options.snkrdunkHtml ?? snkrdunkHtml

  return (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('paypayfleamarket.yahoo.co.jp')) {
      return new Response(yahooMarkup, { status: 200 })
    }

    if (url.includes('snkrdunk.com')) {
      return new Response(snkrMarkup, { status: 200 })
    }

    return new Response('<html></html>', { status: 200 })
  }) as typeof fetch
}

async function createTempWatchlist(
  entries: TempWatchlistEntry[] = [
    {
      id: 'terastal-fes-ex-box',
      title: 'テラスタルフェスex ボックス',
      marketplaces: ['yahoo_flea', 'snkrdunk'],
      searchTerms: ['テラスタルフェスex ボックス'],
      riskGroup: 'sealed',
      cleanExitJpy: 25000,
      damagedExitJpy: 21000,
      exitCostsJpy: 1000,
      salvageJpy: 15000,
      liquidityScore: 0.92,
      active: true
    }
  ]
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'arb-watchlist-'))
  const watchlistPath = join(dir, 'watchlist.json')
  await writeFile(watchlistPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
  return watchlistPath
}

async function createTempLabelsFile(entries: unknown[] = []): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'arb-labels-'))
  const labelsPath = join(dir, 'labels.json')
  await writeFile(labelsPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
  return labelsPath
}

describe('live scan', () => {
  it('parses live marketplace search pages', () => {
    const yahoo = parseMarketplaceSearchPage(
      'yahoo_flea',
      yahooHtml,
      'テラスタルフェスex ボックス'
    )
    const snkr = parseMarketplaceSearchPage(
      'snkrdunk',
      snkrdunkHtml,
      'テラスタルフェスex ボックス'
    )

    expect(yahoo).toHaveLength(1)
    expect(yahoo[0].sourceListingId).toBe('z12345')
    expect(yahoo[0].sourceQuery).toBe('テラスタルフェスex ボックス')
    expect(snkr).toHaveLength(1)
    expect(snkr[0].sourceListingId).toBe('424297')
  })

  it('marks sealed listings with シュリンクなし as missing shrink wrap', async () => {
    const watchlistPath = await createTempWatchlist()
    const artifactStore = new MemoryArtifactStore()
    const fetchImpl = makeFetch({ yahooHtml: shrinkMissingYahooHtml })

    const result = await runLiveScan({
      watchlistPath,
      labelsPath: 'data/sample-labels.json',
      configPath: 'data/scoring-config.json',
      watchlistLimit: 1,
      queryStrategy: 'primary',
      sourceFilter: ['yahoo_flea'],
      limitPerQuery: 5,
      searchConcurrency: 1,
      fetchTimeoutMs: 2000,
      maxNotifications: 5,
      maxReviews: 5,
      artifactStore,
      fetchImpl,
      notifyAlex: false
    })

    expect(result.opportunities[0]?.shrinkWrapState).toBe('missing')
    expect(result.reviews[0]?.evidence).toContain('shrink-wrap missing')
  })

  it('scans, writes inbox artifacts, and suppresses duplicate alerts on repeat', async () => {
    const watchlistPath = await createTempWatchlist()
    const artifactStore = new MemoryArtifactStore()
    const fetchImpl = makeFetch()

    const first = await runLiveScan({
      watchlistPath,
      labelsPath: 'data/sample-labels.json',
      configPath: 'data/scoring-config.json',
      watchlistLimit: 1,
      queryStrategy: 'primary',
      sourceFilter: ['yahoo_flea', 'snkrdunk'],
      limitPerQuery: 5,
      searchConcurrency: 2,
      fetchTimeoutMs: 2000,
      maxNotifications: 5,
      maxReviews: 5,
      artifactStore,
      fetchImpl,
      notifyAlex: false
    })

    expect(first.scrapedListings.length).toBeGreaterThanOrEqual(2)
    expect(first.notifications.length).toBeGreaterThanOrEqual(1)
    expect(first.alexDigest).toContain('coverage=raw')
    expect(first.alexDigest).toContain('sources=yahoo_flea:ok')
    expect(await artifactStore.readJson<LiveScanResult>('scans/latest.json')).not.toBeNull()
    const emptyState = await loadLiveState(artifactStore)
    expect(emptyState).toEqual({ entries: {} })

    const initialSelection = selectFreshAlerts(first, emptyState, {
      cooldownMinutes: 10
    })
    await saveLiveState(initialSelection.state, artifactStore)

    const stateAfterFirst = await loadLiveState(artifactStore)
    expect(Object.keys(stateAfterFirst.entries)).toHaveLength(first.scores.length)

    const secondSelection = selectFreshAlerts(first, stateAfterFirst, {
      cooldownMinutes: 10
    })

    expect(secondSelection.freshNotifications).toHaveLength(0)
    expect(secondSelection.freshReviews).toHaveLength(0)
  })

  it('folds Alex feedback into the next calibration pass', async () => {
    const watchlistPath = await createTempWatchlist()
    const labelsPath = await createTempLabelsFile([])
    const artifactStore = new MemoryArtifactStore()
    const fetchImpl = makeFetch()

    await artifactStore.writeJson('feedback/latest.json', [
      {
        listingId: 'snkrdunk:567433',
        marketplace: 'snkrdunk',
        riskGroup: 'sealed',
        authenticity: 'authentic',
        condition: 'clean',
        recommendedAction: 'pass',
        confidence: 1,
        notes: 'シュリンクなし, not factory sealed, calculated at sealed price',
        sourceUrl: 'https://snkrdunk.com/apparels/567433',
        sourceListingId: '567433',
        sourceQuery: 'ポケモンカード151 ボックス',
        reviewer: 'alex',
        reviewedAt: '2026-04-09T10:20:40.893Z'
      }
    ])

    const result = await runLiveScan({
      watchlistPath,
      labelsPath,
      configPath: 'data/scoring-config.json',
      watchlistLimit: 1,
      queryStrategy: 'primary',
      sourceFilter: ['yahoo_flea', 'snkrdunk'],
      limitPerQuery: 5,
      searchConcurrency: 2,
      fetchTimeoutMs: 2000,
      maxNotifications: 5,
      maxReviews: 5,
      artifactStore,
      fetchImpl,
      notifyAlex: false
    })

    expect(result.report.labels.totalLabels).toBe(1)
    expect(result.alexDigest).toContain('calibrationLabels=1')
    expect(result.alexDigest).toContain('sources=')
  })

  it('marks mercari as unsupported in the scan digest when the public HTML has no cards', async () => {
    const watchlistPath = await createTempWatchlist([
      {
        id: 'mercari-terastal-fes-ex-box',
        title: 'テラスタルフェスex ボックス',
        marketplaces: ['mercari'],
        searchTerms: ['テラスタルフェスex ボックス'],
        riskGroup: 'sealed',
        cleanExitJpy: 25000,
        damagedExitJpy: 21000,
        exitCostsJpy: 1000,
        salvageJpy: 15000,
        liquidityScore: 0.92,
        active: true
      }
    ])
    const artifactStore = new MemoryArtifactStore()
    const fetchImpl = makeFetch()

    const result = await runLiveScan({
      watchlistPath,
      labelsPath: 'data/sample-labels.json',
      configPath: 'data/scoring-config.json',
      watchlistLimit: 1,
      queryStrategy: 'primary',
      sourceFilter: ['mercari'],
      limitPerQuery: 5,
      searchConcurrency: 1,
      fetchTimeoutMs: 2000,
      maxNotifications: 5,
      maxReviews: 5,
      artifactStore,
      fetchImpl,
      notifyAlex: false
    })

    expect(result.sourceSummaries[0]?.status).toBe('unsupported')
    expect(result.alexDigest).toContain('coverage=raw 0 | slab 0 | sealed 0')
    expect(result.alexDigest).toContain('sources=mercari:unsupported')
    expect(result.alexDigest).toContain('source-notes=mercari:')
  })
})
