# Architecture

## Current MVP
- Solana program stores policy + paid requests.
- Watcher/indexer monitors state changes.
- Notification service sends popup to companion app.

## Why this split
- Keeps on-chain logic minimal and auditable.
- Allows faster iteration on delivery UX off-chain.

## Future Layer
- Agent reputation subsystem (post-hackathon):
  - sender score
  - recipient feedback
  - abuse flags
  - optional stake/reputation weighting for delivery or pricing multipliers
