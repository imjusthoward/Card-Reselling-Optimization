# Japan TCG Arb Copilot

Scoring engine for Japan-first TCG arbitrage.

This repo is intentionally small and explainable:

- `src/calibration.ts` turns trader labels into market-specific priors
- `src/score.ts` scores listings as `buy`, `watch`, or `pass`
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
```

## Files to edit first

- `data/sample-listings.json` for live opportunities
- `data/sample-labels.json` for trader feedback
- `data/scoring-config.json` for thresholds and priors
- `docs/trader-manual.md` for the review process

## Reference repos cloned locally

The `vendor/reference/` folder contains shallow clones of the open-source repos that informed this build. They are kept out of the main package and ignored by git.
