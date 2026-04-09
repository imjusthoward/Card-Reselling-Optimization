import { describe, expect, it } from 'vitest'
import { renderDashboardHtml } from '../src/dashboard.js'

describe('dashboard html', () => {
  it('includes the live queue and review controls', () => {
    const html = renderDashboardHtml()

    expect(html).toContain('Live queue')
    expect(html).toContain('Selected listing')
    expect(html).toContain('feedback-form')
    expect(html).toContain('scan-button')
    expect(html).toContain('Copy digest')
  })
})
