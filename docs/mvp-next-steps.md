# MVP Next Steps

This repo now covers the first operating loop for the card-arbitrage MVP:

- score a batch of listings
- turn the best ones into notification payloads
- turn the borderline ones into trader review packets
- summarize label quality and the infrastructure you still need

## 30-Day Rollout

### Week 1

- Hook live listings into the scorer.
- Run `npm run notify` on every fresh batch.
- Send only the highest-confidence buy alerts to the trader.

### Week 2

- Run `npm run review` for every buy or watch call.
- Capture trader labels in a dedicated file, not in chat.
- Keep notes short and evidence-based.

### Week 3

- Review `npm run summary` once a week.
- Track buy precision, false positives, and realized profit.
- Tighten the alert threshold if the queue is too noisy.

### Week 4

- Decide whether the current signal quality justifies more automation.
- If not, keep the loop human-approved and collect more labels.
- If yes, add a richer dashboard before any auto-buy work.

## Infrastructure To Procure

### Required Now

- one always-on worker or scheduler
- one notification sink, such as Telegram, WhatsApp, SMS, or a simple dashboard
- append-only storage for trader labels
- secret storage for API keys and webhook tokens
- basic audit logs for alerts and manual approvals

### Recommended Soon

- a small review dashboard for Alex or the trader
- persistent storage beyond a single JSON file
- a queue if listing volume rises
- object storage if you begin retaining images for OCR or vision checks

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

## Deployed Stack

The current live GCP footprint is:

- project: `japan-tcg-arb-260409`
- service URL: `https://arb-api-453828005739.asia-northeast1.run.app`
- Cloud Run job: `arb-scan`
- Cloud SQL: `arb-postgres`
- BigQuery dataset: `arb_analytics`
- Artifact Registry: `arb-images`
- evidence bucket: `gs://japan-tcg-arb-evidence-453828005739`
- search app: `arb-trader-assist`
- deploy topic: `arb-deploy`
- deploy trigger: `arb-deploy-trigger`

Billing export to BigQuery is still pending console enablement and is the only major procurement item not yet wired.
