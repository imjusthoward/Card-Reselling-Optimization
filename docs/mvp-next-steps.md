# MVP Next Steps

This repo now covers the first operating loop for the card-arbitrage MVP:

- score a batch of listings
- turn the best ones into notification payloads
- turn the borderline ones into trader review packets
- scan live marketplace pages on a short cadence
- suppress duplicate alerts until the listing changes or cools down
- summarize label quality and the infrastructure you still need

## 30-Day Rollout

### Week 1

- Hook live listings into the scorer.
- Run `npm run scan` against the top watchlist slice.
- Send the freshest alerts to Alex in notification form.
- Keep the first pass focused on the highest-liquidity cards and sealed boxes.

### Week 2

- Run `npm run review` for the buy or watch call queue.
- Capture trader labels in a dedicated file, not in chat.
- Keep notes short and evidence-based.
- Add the Alex feedback webhook or `/live/feedback` route to close the loop.

### Week 3

- Review `npm run summary` once a week.
- Track buy precision, false positives, and realized profit.
- Tighten the alert threshold if the queue is too noisy.
- Decide whether Mercari needs the browser-backed poller for full coverage.

### Week 4

- Decide whether the current signal quality justifies more automation.
- If not, keep the loop human-approved and collect more labels.
- If yes, add a richer dashboard before any auto-buy work.
- If the 30-second alert loop is clean, scale the worker to the full priority watchlist.

## Infrastructure To Procure

### Required Now

- one always-on worker or VM running a 30-second poll loop
- one notification sink, such as Telegram, WhatsApp, SMS, email, or a simple dashboard
- append-only storage for trader labels
- secret storage for API keys and webhook tokens
- basic audit logs for alerts and manual approvals
- a shared artifact bucket for live scans and feedback

### Recommended Soon

- a small review dashboard for Alex or the trader
- persistent storage beyond a single JSON file
- a queue if listing volume rises
- object storage if you begin retaining images for OCR or vision checks
- browser-backed Mercari polling if fetch-only scraping stays incomplete

### Defer Until Later

- managed OCR or vision services
- auto-buy execution infrastructure
- multi-region high availability
- GPU capacity for larger image models

## Decision Rule

Do not buy heavier infrastructure until the manual loop proves:

- the alerts are actually useful
- the trader can label fast enough
- the false-positive rate stays acceptable
- the realized profit is still positive after fees and condition losses

## Future Lanes

These are expansion ideas, not current MVP scope:

- Auto-listing: only after explicit human approval, marketplace policy review, and a proven return path. Treat any eBay or cross-market listing flow as a fulfillment workflow, not a blind bot.
- Pregrader: build a photo-based grading proxy that scores centering, corners, edges, and surface defects. Use it to support review and pricing, not to replace human judgment.
- Sentiment: run offline sentiment analysis on public channels to look for likely price runs, then backtest against historical price movement before adding it to live scoring.

Gate each lane on three checks:

- the current live loop is stable
- the trader can explain why the signal matters
- the added signal improves realized profit or review speed in backtests

## Deployed Stack

The current live GCP footprint is:

- project: `japan-tcg-arb-260409`
- service URL: `https://arb-api-453828005739.asia-northeast1.run.app`
- Cloud Run job: `arb-scan`
- live worker VM: `arb-live-worker`
- Cloud SQL: `arb-postgres`
- BigQuery dataset: `arb_analytics`
- Artifact Registry: `arb-images`
- evidence bucket: `gs://japan-tcg-arb-evidence-453828005739`
- search app: `arb-trader-assist`
- deploy topic: `arb-deploy`
- deploy trigger: `arb-deploy-trigger`

Billing export to BigQuery is still pending console enablement and is the only major procurement item not yet wired.
