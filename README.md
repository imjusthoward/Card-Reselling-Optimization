# Japan TCG Arb Copilot

Scoring engine for Japan-first TCG arbitrage.

This repo is intentionally small and explainable:

- `src/calibration.ts` turns trader labels into market-specific priors
- `src/score.ts` scores listings as `buy`, `watch`, or `pass`
- `src/mvp.ts` turns scores into notification packets, review packets, and an MVP report
- `src/cli.ts` scores JSON listings from the command line
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
```

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

## Infrastructure to procure now

For the MVP in this repo, you do not need a large stack. The minimum is:

- one always-on scheduler or worker
- one notification sink, such as Telegram, WhatsApp, SMS, or a simple dashboard
- append-only label storage for trader feedback
- secret storage for API keys and webhook tokens

Everything else can wait until the signal quality is proven.

## Reference repos cloned locally

The `vendor/reference/` folder contains shallow clones of the open-source repos that informed this build. They are kept out of the main package and ignored by git.
