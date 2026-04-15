# Card Reselling Optimization

Scoring engine for Japan-first trading card arbitrage. Takes marketplace listings, applies calibrated priors from trader feedback, and outputs `buy`, `watch`, or `pass` signals with a structured review queue.

## How It Works

| Module | Role |
|---|---|
| `src/calibration.ts` | Converts trader labels into market-specific priors |
| `src/score.ts` | Scores listings as `buy`, `watch`, or `pass` |
| `src/mvp.ts` | Produces notification packets, review packets, and pipeline summary |
| `src/scan.ts` | Runs live marketplace scan and prints alert digest |
| `src/worker.ts` | Keeps live scan running on a 30-second loop |
| `src/cli.ts` | Scores JSON listings from the command line |

Supporting docs:
- `docs/trader-manual.md` — data format and labeling process
- `docs/reference-map.md` — maps open-source references to each layer

## Getting Started

```bash
npm install
npm test
npm run build
```

Score a batch of listings:
```bash
npm run score -- \
  --listings data/sample-listings.json \
  --labels data/sample-labels.json \
  --config data/scoring-config.json
```

Run the live alert loop:
```bash
npm run live:worker
```

## Data Files

| File | Purpose |
|---|---|
| `data/sample-listings.json` | Input listings to score |
| `data/sample-labels.json` | Trader feedback for calibration |
| `data/scoring-config.json` | Thresholds and priors |

## MVP Feedback Loop

1. Score fresh listings → route `notify` output to operator
2. Route `review` output to trader for human labeling
3. Save labels back into `data/sample-labels.json`
4. Run `npm run summary` to check pipeline health and label coverage
5. Repeat — signal quality improves with each labeling round

## Minimum Infrastructure

The scoring engine is self-contained. To run it continuously you need:

- One always-on worker or VM for the 30-second poll loop
- One notification sink (Telegram, email, dashboard)
- Append-only storage for trader feedback labels
- Secret storage for API keys

## License

MIT