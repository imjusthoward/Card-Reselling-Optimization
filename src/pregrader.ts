import type { OpportunityListing, PhotoPregrade } from './types.js'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

function gradeBandFromScores(centeringScore: number, photoQualityScore: number): string {
  const combined = centeringScore * 0.55 + photoQualityScore * 0.45

  if (combined >= 0.88) {
    return 'Gem Mint candidate'
  }

  if (combined >= 0.78) {
    return 'Mint candidate'
  }

  if (combined >= 0.66) {
    return 'Near Mint-Mint candidate'
  }

  if (combined >= 0.52) {
    return 'Near Mint candidate'
  }

  return 'Low-confidence / manual review'
}

export function estimatePhotoPregrade(listing: OpportunityListing): PhotoPregrade {
  const imageEvidence = listing.imageEvidence
  const photoCount = imageEvidence?.photoCount ?? listing.imageUrls?.length ?? 0
  const reasons: string[] = []

  let centeringScore = 0.5
  let photoQualityScore = 0.5

  if (photoCount >= 4) {
    centeringScore += 0.08
    photoQualityScore += 0.12
    addReason(reasons, 'multi-photo-set')
  } else if (photoCount >= 2) {
    centeringScore += 0.04
    photoQualityScore += 0.06
  }

  if (photoCount <= 1) {
    centeringScore -= 0.16
    photoQualityScore -= 0.2
    addReason(reasons, 'thin-photo-set')
  }

  if (imageEvidence?.frontVisible) {
    centeringScore += 0.08
    photoQualityScore += 0.08
    addReason(reasons, 'front-visible')
  } else {
    centeringScore -= 0.08
    photoQualityScore -= 0.05
    addReason(reasons, 'front-not-visible')
  }

  if (imageEvidence?.backVisible) {
    centeringScore += 0.06
    photoQualityScore += 0.08
    addReason(reasons, 'back-visible')
  } else if (listing.riskGroup !== 'sealed') {
    photoQualityScore -= 0.08
    addReason(reasons, 'back-photo-missing')
  }

  if (imageEvidence?.closeupsVisible) {
    centeringScore += 0.04
    photoQualityScore += 0.08
    addReason(reasons, 'closeups-visible')
  }

  if (imageEvidence?.certVisible && listing.riskGroup === 'slab') {
    centeringScore += 0.08
    photoQualityScore += 0.14
    addReason(reasons, 'cert-visible')
  }

  if (listing.riskGroup === 'sealed') {
    if (listing.shrinkWrapState === 'present') {
      photoQualityScore += 0.12
      addReason(reasons, 'shrink-wrap-present')
    } else if (listing.shrinkWrapState === 'missing') {
      centeringScore -= 0.06
      photoQualityScore -= 0.18
      addReason(reasons, 'shrink-wrap-missing')
    }
  }

  if (listing.sellerSignals?.rating == null && listing.sellerSignals?.salesCount == null) {
    photoQualityScore -= 0.05
    addReason(reasons, 'seller-unknown')
  }

  centeringScore = clamp(centeringScore, 0.01, 0.99)
  photoQualityScore = clamp(photoQualityScore, 0.01, 0.99)

  return {
    centeringScore,
    photoQualityScore,
    estimatedGradeBand: gradeBandFromScores(centeringScore, photoQualityScore),
    reasons
  }
}

export function formatPhotoPregrade(pregrade: PhotoPregrade): string {
  return [
    `centering ${(pregrade.centeringScore * 100).toFixed(0)}%`,
    `photo quality ${(pregrade.photoQualityScore * 100).toFixed(0)}%`,
    pregrade.estimatedGradeBand,
    pregrade.reasons.length > 0 ? `why ${pregrade.reasons.join(', ')}` : undefined
  ]
    .filter((line): line is string => line != null)
    .join(' | ')
}
