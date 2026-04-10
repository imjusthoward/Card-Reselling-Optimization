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
    expect(html).toContain('Notes and priming')
    expect(html).toContain('feedback-form')
    expect(html).toContain('scan-button')
    expect(html).toContain('Copy digest')
    expect(html).toContain('Scan health')
    expect(html).toContain('used in calibration')
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
    expect(html).toContain('feedback-note')
  })

  it('renders every feedback row and shows calibration supersession for duplicate notes', () => {
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
        listingId: 'snkrdunk:567433',
        marketplace: 'snkrdunk',
        riskGroup: 'sealed',
        authenticity: 'fake',
        condition: 'uncertain',
        recommendedAction: 'pass',
        reviewedAt: '2026-04-09T10:19:20.893Z',
        notes: 'Same seller, 0 reviews, and a blurry photo should have been flagged earlier.'
      }
    ], {
      generatedAt: '2026-04-09T10:21:00.893Z',
      report: {
        labels: {
          totalLabels: 9
        }
      }
    })

    expect((feedbackHtml.match(/feedback-row/g) ?? []).length).toBe(2)
    expect(feedbackHtml).toContain('priming active')
    expect(feedbackHtml).toContain('used 1/2')
    expect(feedbackHtml).toContain('superseded 1')
    expect(feedbackHtml).toContain('Notes and priming')
    expect(feedbackHtml).toContain('seal risk')
    expect(feedbackHtml).toContain('seller risk')
    expect(feedbackHtml).toContain('Full note')
    expect(feedbackHtml).toContain('used in calibration')
    expect(feedbackHtml).toContain('superseded')

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
