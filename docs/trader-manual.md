# Trader Manual

This workflow is for the experienced card trader who helps improve the model.

The goal is to feed the algorithm better evidence, not to guess on every listing.
When you are unsure, mark the item `uncertain`.

## What the model needs from you

Each reviewed listing should have:

- `marketplace`
- `riskGroup` (`raw`, `slab`, `sealed`)
- `authenticity` (`authentic`, `fake`, `uncertain`)
- `condition` (`clean`, `damaged`, `uncertain`)
- `recommendedAction` (`buy`, `pass`, `watch`)
- `confidence` from `0` to `1`
- `realizedProfitJpy` when the item has already been sold
- short notes explaining why you made the call

## Labeling rules

### Authenticity

- Use `authentic` only when you would buy the card yourself.
- Use `fake` when the listing is clearly counterfeit, mislabeled, or the slab is inconsistent with the cert or photos.
- Use `uncertain` when the evidence is not enough.

### Condition

- Use `clean` when the card looks strong enough to sell at the clean exit price.
- Use `damaged` when whitening, dents, bends, case damage, or other visible defects force the damaged exit path.
- Use `uncertain` when the photo set is incomplete.

### Photo evidence

The model trusts better evidence more than cheap price:

- front and back photos help
- multiple angles help
- cert number visibility helps for slabs
- closeups help for condition calls

If the listing has only one weak photo, do not force a verdict.

## What matters most by product type

### Raw cards

- Check print quality, borders, edges, centering, and surface.
- Use `uncertain` if the back photo is missing.
- Do not let a strong price spread override a weak photo set.

### Slabs

- Confirm the cert number when visible.
- Check label consistency, slab cracks, scratches, and any sign of tampering.
- If the cert is not readable, keep the authenticity label conservative.

### Sealed product

- Look for shrink integrity, box corners, seal consistency, and mismatched packaging.
- If the seal cannot be verified, mark `uncertain`.

## How to feed the model

1. Run the scorer on the current listing file.
2. Review the top `buy` and `watch` calls.
3. Save your labels in `data/sample-labels.json` or your own label file.
4. Re-run calibration so the priors update.
5. Compare the new output against what you actually bought and sold.

## Recommended review format

Use a short note that explains the evidence, not the conclusion.

Good:

- `cert readable, clean edges, seller history strong`
- `back photo missing, likely damaged, not enough evidence`
- `price too low for normal market, possible fake or typo`

Bad:

- `looks fine`
- `probably okay`
- `hard to say`

## Example label

```json
{
  "listingId": "mercari-001",
  "marketplace": "mercari",
  "riskGroup": "slab",
  "authenticity": "authentic",
  "condition": "clean",
  "recommendedAction": "buy",
  "confidence": 0.92,
  "realizedProfitJpy": 18450,
  "notes": "Cert readable, slab clean, price sheet matched"
}
```

## What to avoid

- Do not invent a condition grade if the photo set is too weak.
- Do not use the asking price alone as a proxy for authenticity.
- Do not leave notes empty on borderline cases.
- Do not overcall `authentic` if you would not personally take the trade.

