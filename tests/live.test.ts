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

const mercariEmbeddedHtml = `
  <html>
    <body>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "search": {
                "items": [
                  {
                    "id": "m98765",
                    "title": "テラスタルフェスex ボックス",
                    "price": 14980,
                    "imageUrl": "https://example.com/mercari-json.jpg"
                  }
                ]
              }
            }
          }
        }
      </script>
    </body>
  </html>
`

const mercariHtml = `
  <html>
    <body>
      <a href="https://jp.mercari.com/item/m12345678901">
        <img alt="テラスタルフェスex ボックス" data-src="https://example.com/mercari.jpg" />
        <p>15,800円</p>
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

function makeFetch(options: {
  yahooHtml?: string
  snkrdunkHtml?: string
  mercariHtml?: string
  mercariApiJson?: unknown
  mercariApiStatus?: number
} = {}): typeof fetch {
  const yahooMarkup = options.yahooHtml ?? yahooHtml
  const snkrMarkup = options.snkrdunkHtml ?? snkrdunkHtml
  const mercariMarkup = options.mercariHtml ?? '<html></html>'
  const mercariApiJson = options.mercariApiJson ?? {
    items: [],
    meta: {}
  }
  const mercariApiStatus = options.mercariApiStatus ?? 400

  return (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('paypayfleamarket.yahoo.co.jp')) {
      return new Response(yahooMarkup, { status: 200 })
    }

    if (url.includes('snkrdunk.com')) {
      return new Response(snkrMarkup, { status: 200 })
    }

    if (url.includes('jp.mercari.com')) {
      return new Response(mercariMarkup, { status: 200 })
    }

    if (url.includes('api.mercari.jp')) {
      return new Response(JSON.stringify(mercariApiJson), {
        status: mercariApiStatus,
        headers: {
          'content-type': 'application/json'
        }
      })
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
    expect(first.reviews.length).toBeGreaterThanOrEqual(1)
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

  it('lets Alex note themes bias the next score pass', async () => {
    const watchlistPath = await createTempWatchlist()
    const labelsPath = await createTempLabelsFile([])
    const artifactStore = new MemoryArtifactStore()
    const fetchImpl = makeFetch()

    const baseline = await runLiveScan({
      watchlistPath,
      labelsPath,
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

    const baselineScore = baseline.scores.find(
      score => score.listing.marketplace === 'yahoo_flea' && score.listing.riskGroup === 'sealed'
    )

    expect(baselineScore).toBeDefined()

    await artifactStore.writeJson('feedback/latest.json', [
      {
        listingId: 'yahoo_flea:z12345',
        marketplace: 'yahoo_flea',
        riskGroup: 'sealed',
        authenticity: 'fake',
        condition: 'uncertain',
        recommendedAction: 'pass',
        confidence: 0.95,
        notes: 'Same seller, 0 reviews, blurry photo, and loose packs.',
        sourceUrl: 'https://paypayfleamarket.yahoo.co.jp/item/z12345',
        sourceListingId: 'z12345',
        sourceQuery: 'テラスタルフェスex ボックス',
        reviewer: 'alex',
        reviewedAt: '2026-04-09T10:20:40.893Z'
      }
    ])

    const biased = await runLiveScan({
      watchlistPath,
      labelsPath,
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

    const biasedScore = biased.scores.find(
      score => score.listing.marketplace === 'yahoo_flea' && score.listing.riskGroup === 'sealed'
    )

    expect(biasedScore).toBeDefined()
    expect(biasedScore?.authProbability).toBeLessThan(baselineScore!.authProbability)
    expect(biasedScore?.reasons).toContain('feedback-seller-risk')
  })

  it('uses Mercari embedded JSON fallback when the anchor cards are missing', async () => {
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
    const fetchImpl = makeFetch({ mercariHtml: mercariEmbeddedHtml })

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

    expect(result.scrapedListings).toHaveLength(1)
    expect(result.scrapedListings[0]?.sourceListingId).toBe('m98765')
    expect(result.sourceSummaries[0]?.status).toBe('ok')
    expect(result.sourceSummaries[0]?.note).toContain('embedded JSON fallback')
  })

  it('uses Mercari API fallback when the public HTML has no cards', async () => {
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
    const fetchImpl = makeFetch({
      mercariHtml: '<html><body><main id="empty"></main></body></html>',
      mercariApiJson: {
        items: [
          {
            id: 'mapi555',
            name: 'テラスタルフェスex ボックス',
            price: 15980,
            thumbnails: [{ url: 'https://example.com/mercari-api.jpg' }],
            sellerId: 'seller-123',
            status: 'ACTIVE'
          }
        ],
        meta: {
          nextPageToken: ''
        }
      },
      mercariApiStatus: 200
    })

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

    expect(result.scrapedListings).toHaveLength(1)
    expect(result.scrapedListings[0]?.sourceListingId).toBe('mapi555')
    expect(result.sourceSummaries[0]?.status).toBe('ok')
    expect(result.sourceSummaries[0]?.note).toContain('Mercari search API fallback used')
  })

  it('lets the newest Alex label supersede earlier feedback on the same listing', async () => {
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
        confidence: 0.95,
        notes: 'Latest correction: shrink wrap missing, but authenticity is fine.',
        sourceUrl: 'https://snkrdunk.com/apparels/567433',
        sourceListingId: '567433',
        sourceQuery: 'ポケモンカード151 ボックス',
        reviewer: 'alex',
        reviewedAt: '2026-04-09T10:20:40.893Z'
      },
      {
        listingId: 'snkrdunk:567433',
        marketplace: 'snkrdunk',
        riskGroup: 'sealed',
        authenticity: 'fake',
        condition: 'damaged',
        recommendedAction: 'pass',
        confidence: 0.9,
        notes: 'Old mistaken label that should be ignored for calibration.',
        sourceUrl: 'https://snkrdunk.com/apparels/567433',
        sourceListingId: '567433',
        sourceQuery: 'ポケモンカード151 ボックス',
        reviewer: 'alex',
        reviewedAt: '2026-04-09T10:10:40.893Z'
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
    const targetScore = result.scores.find(
      score => score.listing.marketplace === 'snkrdunk' && score.listing.riskGroup === 'sealed'
    )
    expect(targetScore).toBeDefined()
    expect(targetScore?.authProbability).toBeGreaterThan(0.85)
    expect(targetScore?.cleanProbability).toBeGreaterThan(0.6)
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

  it('parses mercari anchors with absolute item URLs and alternate image attributes', () => {
    const results = parseMarketplaceSearchPage('mercari', mercariHtml, 'テラスタルフェスex ボックス', 5)

    expect(results).toHaveLength(1)
    expect(results[0]?.sourceListingId).toBe('m12345678901')
    expect(results[0]?.title).toBe('テラスタルフェスex ボックス')
    expect(results[0]?.askingPriceJpy).toBe(15800)
    expect(results[0]?.imageUrl).toBe('https://example.com/mercari.jpg')
  })
})
