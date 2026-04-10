import type { CrossListDraft, OpportunityScore } from './types.js'
import { formatPhotoPregrade } from './pregrader.js'

function round(value: number): number {
  return Math.round(value)
}

function formatJpy(value: number): string {
  return `JPY ${round(value).toLocaleString('en-US')}`
}

export function buildCrossListDrafts(
  scores: OpportunityScore[],
  limit = 5
): CrossListDraft[] {
  return scores
    .filter(score => score.recommendation === 'buy' && score.expectedNetJpy > 0)
    .slice()
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit)
    .map(score => {
      const photoPregrade = score.photoPregrade
      const suggestedPriceJpy = Math.max(
        score.listing.askingPriceJpy,
        round(score.expectedExitJpy * 0.97)
      )

      const reasons = [
        'manual approval required before any downstream listing',
        ...score.reasons.slice(0, 4)
      ]

      if (photoPregrade) {
        reasons.push(formatPhotoPregrade(photoPregrade))
      }

      return {
        listingId: score.listing.id,
        targetMarketplace: 'ebay',
        sourceMarketplace: score.listing.marketplace,
        title: score.listing.title,
        sourceUrl: score.listing.sourceUrl,
        sourceListingId: score.listing.sourceListingId,
        sourceQuery: score.listing.sourceQuery,
        suggestedPriceJpy,
        suggestedPriceLabel: `${formatJpy(suggestedPriceJpy)} draft`,
        approvalRequired: true,
        fulfillmentPlan:
          'Hold source item until a downstream sale is approved, then buy from the first seller, receive, inspect, and ship to the customer.',
        reasons,
        photoPregrade
      }
    })
}
