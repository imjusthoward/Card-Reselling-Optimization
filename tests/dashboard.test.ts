import { describe, expect, it } from 'vitest'
import {
  buildFeedbackListHtml,
  renderDashboardHtml,
  resolveSelectedIdAfterRefresh
} from '../src/dashboard.js'

describe('dashboard html', () => {
  it('includes the live queue and review controls', () => {
    const html = renderDashboardHtml()

    expect(html).toContain('Live queue')
    expect(html).toContain('Selected listing')
    expect(html).toContain('Feedback history')
    expect(html).toContain('feedback-form')
    expect(html).toContain('scan-button')
    expect(html).toContain('Copy digest')
    expect(html).toContain('Scan health')
  })

  it('persists in-progress feedback drafts across refreshes', () => {
    const html = renderDashboardHtml()

    expect(html).toContain('japan-tcg-arb-feedback-drafts')
    expect(html).toContain('feedbackFormDirty')
    expect(html).toContain('saveFeedbackDraft')
    expect(html).toContain('shouldPreserveDetailOnRefresh')
    expect(html).toContain('sourceSummaries')
    expect(html).toContain('scrapedAt')
    expect(html).toContain('signal-strong')
    expect(html).toContain('feedback-summary')
    expect(html).toContain('feedback-row')
    expect(html).toContain('reviewedAt')
  })

  it('renders every feedback row and preserves the dirty selection on refresh', () => {
    const feedbackHtml = buildFeedbackListHtml([
      {
        listingId: 'snkrdunk:567433',
        marketplace: 'snkrdunk',
        riskGroup: 'sealed',
        authenticity: 'authentic',
        condition: 'clean',
        recommendedAction: 'pass',
        reviewedAt: '2026-04-09T10:20:40.893Z',
        notes: 'シュリンクなし, not factory sealed, calculated at sealed price'
      },
      {
        listingId: 'yahoo_flea:z543712814',
        marketplace: 'yahoo_flea',
        riskGroup: 'sealed',
        authenticity: 'fake',
        condition: 'uncertain',
        recommendedAction: 'pass',
        reviewedAt: '2026-04-09T10:19:20.893Z',
        notes: 'Same seller and situation as Source listing id: z545864876'
      }
    ])

    expect((feedbackHtml.match(/feedback-row/g) ?? []).length).toBe(2)
    expect(feedbackHtml).toContain('feedback-summary')
    expect(feedbackHtml).toContain('Calibration feed')

    expect(
      resolveSelectedIdAfterRefresh(
        'snkrdunk:567433',
        [{ listingId: 'yahoo_flea:z543712814' }],
        true
      )
    ).toBe('snkrdunk:567433')
    expect(
      resolveSelectedIdAfterRefresh(
        'snkrdunk:567433',
        [{ listingId: 'yahoo_flea:z543712814' }],
        false
      )
    ).toBe('yahoo_flea:z543712814')
  })
})
