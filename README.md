# Paid Agent Advertisement Notifications (Solana)

Recipient-controlled, paid ad notifications for wallet users.

## Core idea
Users publish a wallet-linked ad notification policy. Agents must pay to send ad notifications. A watcher surfaces policy-compliant paid requests as notifications.

## Hackathon MVP (in scope)
- Recipient policy on-chain (min fee, categories, basic limits, enable/disable)
- Paid ad notification request submission on-chain
- Off-chain watcher/indexer
- Notification-first UX (open/dismiss/block)

## Out of scope for hackathon
- Full privacy-preserving recipient batching
- ZK delivery proofs
- Fully decentralized notification transport
- **Agent reputation ratings system** (planned roadmap feature)

## Minimal Anchor contract (devnet)
A minimal Anchor program scaffold is now included under:
- `programs/paid_ad_notifications/src/lib.rs`

Key instructions:
- `upsert_policy`
- `submit_ad_request`
- `update_request_status`

See `docs/CONTRACT_DEVNET_MINIMAL.md` for details and next deploy steps.

## Docs
- `docs/PRD.md`
- `docs/SRD.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRACT_DEVNET_MINIMAL.md`
