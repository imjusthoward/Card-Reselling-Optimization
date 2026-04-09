# Japan TCG Arb Copilot

Scoring engine for Japan-first TCG arbitrage.

This repo is intentionally small and explainable:

- `src/calibration.ts` turns trader labels into market-specific priors
- `src/score.ts` scores listings as `buy`, `watch`, or `pass`
- `src/mvp.ts` turns scores into notification packets, review packets, and an MVP report
- `src/cli.ts` scores JSON listings from the command line
- `src/scan.ts` runs the live marketplace scan and prints the alert digest
- `src/worker.ts` keeps the live scan running on a 30-second loop
- `docs/trader-manual.md` tells the trader what data to provide and how to label it
- `docs/reference-map.md` explains which cloned repos informed each layer

## What this is for

The goal is not auto-buying on day one. The goal is to produce:

- high-confidence buy leads
- a repeatable way to train the model from trader feedback
- clean exports that can later be pushed into a web app or API

## Local workflow

```bash
npm install
npm test
npm run build
npm run score -- --listings data/sample-listings.json --labels data/sample-labels.json --config data/scoring-config.json
npm run notify
npm run review
npm run summary
npm run scan -- --output digest --watchlist-limit 1 --query-strategy primary --source-filter yahoo_flea,snkrdunk --no-notify-alex
npm run live:worker
```

Open `http://localhost:8080/dashboard` for the live operator inbox. In Cloud Run, Alex can use the same `/dashboard` route and paste the shared API key once to unlock live data.

## Files to edit first

- `data/sample-listings.json` for live opportunities
- `data/sample-labels.json` for trader feedback
- `data/scoring-config.json` for thresholds and priors
- `docs/trader-manual.md` for the review process
- `docs/mvp-next-steps.md` for the 30-day rollout and infra checklist

## MVP workflow

1. Run the scorer on fresh listings.
2. Route `notify` output to the operator's messenger or dashboard.
3. Route `review` output to the trader for human labeling.
4. Save labels back into `data/sample-labels.json` or a separate label file.
5. Run `npm run summary` to see pipeline health, label coverage, and what infrastructure is actually needed now.
6. Use `npm run scan` or `npm run live:worker` for the low-latency alert loop.
7. Send Alex feedback back through `POST /live/feedback` or the live worker webhook so the model keeps learning.
8. Use `GET /dashboard` for the live queue, detail pane, and fast review form.

## Infrastructure to procure now

For the MVP in this repo, you do not need a large stack. The minimum is:

- one always-on worker or VM running a 30-second poll loop
- one notification sink, such as Telegram, WhatsApp, SMS, email, or a simple dashboard
- append-only label storage for trader feedback
- secret storage for API keys and webhook tokens
- a shared artifact bucket for live scans, alerts, and feedback

Everything else can wait until the signal quality is proven.

## Live GCP Footprint

The current deployed stack is in `japan-tcg-arb-260409`:

- Cloud Run service: `arb-api`
- Cloud Run job: `arb-scan`
- live worker: `arb-live-worker`
- Cloud SQL instance: `arb-postgres`
- BigQuery dataset: `arb_analytics`
- Artifact Registry repo: `arb-images`
- Evidence bucket: `gs://japan-tcg-arb-evidence-453828005739`
- Vertex AI Search app: `arb-trader-assist`
- Pub/Sub deploy topic: `arb-deploy`
- Cloud Build deploy trigger: `arb-deploy-trigger`

The deploy trigger uses [cloudbuild-deploy.yaml](./cloudbuild-deploy.yaml). The build config redeploys `arb-api` from the current Artifact Registry image and keeps the runtime config in sync with the local codebase.

Billing export to BigQuery is the one remaining dashboard-only setup item and is still pending console enablement.

## Reference repos cloned locally

The `vendor/reference/` folder contains shallow clones of the open-source repos that informed this build. They are kept out of the main package and ignored by git.
