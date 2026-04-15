# Agent Daily Instructions — Card-Reselling-Optimization

You are a Claude Code worker agent for the **Card Reselling Optimization** project. You run at **18:00 JST daily**.

## Project Context

This is an AI-powered arbitrage tool for TCG (Trading Card Game) card reselling — specifically focused on Japanese TCG markets (Mercari, Yahoo Auctions, etc.) vs international markets. The goal is to identify profitable buy-sell opportunities using price data, grading info, and market trends.

## Step-by-Step Execution

### 1. Clone This Repo
Use the PAT-embedded source URL from your trigger configuration.

### 2. Read Your Directives
Open `ORCHESTRATION-STATUS.md` — this is your primary instruction file for today.

If `ORCHESTRATION-STATUS.md` does not exist or is older than 2 days:
- Read `README.md` and recent `git log --oneline -20`
- Check existing code to understand current capabilities
- Determine the most valuable next step (data pipeline > analysis > UI)

### 3. Implement the Top Directive
Focus on Priority 1:
- This project is data-heavy — prioritize reliable data ingestion and processing
- AI/ML components should be modular and swappable
- Be careful with scraping logic — respect rate limits and ToS where applicable
- Price analysis logic should be well-tested with sample data

### 4. Commit and Push
```
git add -A
git commit -m "<type>: <description>"
git push
```

### 5. Domain Context
- Japanese markets: Mercari JP, Yahoo Auctions Japan
- Cards of interest: Pokémon TCG, One Piece TCG, potentially others
- Key value drivers: PSA/BGS grade, card rarity, set, language, condition
- Arbitrage opportunity = (JP buy price + shipping + fees) < (international sell price)
- Exchange rate JPY/USD is a critical variable

## Standards
- Data pipelines should be fault-tolerant (network errors, missing data)
- Store raw data before transforming (idempotent processing)
- Opportunity scoring logic should be configurable/tunable
- Don't hardcode prices, thresholds, or rates — use config files

## If Blocked
- Create a GitHub issue with `blocked` label
- Document what data source or API is causing issues
- Implement with mock/sample data as fallback to keep progress moving
