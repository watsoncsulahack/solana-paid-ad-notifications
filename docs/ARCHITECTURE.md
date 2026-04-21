# Architecture

## Current MVP Architecture (Web2.5)

### Frontend
- Wallet connect/sign-in UI (Phantom + wallet-router fallback)
- Recipient opt-in/preferences UI
- Advertiser ad creation + payment initiation UI
- Recipient popup notification UI

### Backend (web25)
- Nonce challenge + signature verification
- Recipient/ad request records
- tx signature linkage (`ad_request -> tx_signature`)
- Solana transaction confirmation check
- notification trigger + status transitions
- agent gateway scaffold endpoints for monetized skill execution

### Data layer
- JSON-backed local DB for MVP (`web25/data/db.json`)
- Planned migration path: Postgres/Supabase

### Solana role
- Devnet payment rail and public proof anchor
- On-chain transfer confirmation drives delivery eligibility

## Responsibilities split

### Off-chain responsibilities
- identity/session management
- preferences and routing logic
- ad request lifecycle
- notification state and analytics

### On-chain responsibilities
- advertiser-funded transfer settlement
- transaction verifiability

## Why this shape
Podcast feedback reinforced that a demo-successful build should prioritize:
- **clarity of economic gating**,
- **reliable end-to-end flow**,
- **tight scope under deadline**,
not maximal decentralization of every subsystem.

## Non-goals for MVP
- full decentralized inbox state,
- privacy-preserving recipient obfuscation,
- protocol-level reputation graph,
- generalized wallet-native push infra.

## Extension points
- Replace direct-transfer checks with contract-mediated semantics.
- Add batched payout engine.
- Add production DB + background workers/webhooks.
- Package agent gateway as paid API product (e.g., Lobster Cash listing).