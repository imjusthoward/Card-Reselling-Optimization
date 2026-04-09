import { describe, expect, it } from 'vitest'
import { buildWorkflowOutputs, loadWorkflow } from '../src/workflow.js'

describe('workflow runtime', () => {
  it('loads the default sample workflow and produces outputs', async () => {
    const workflow = await loadWorkflow()
    const outputs = buildWorkflowOutputs(workflow.scores, 'dashboard')

    expect(workflow.report.pipeline.total).toBe(3)
    expect(workflow.report.labels.totalLabels).toBe(4)
    expect(outputs.notifications.length).toBeGreaterThanOrEqual(0)
    expect(outputs.reviews.length).toBeGreaterThanOrEqual(outputs.notifications.length)
  })
})
