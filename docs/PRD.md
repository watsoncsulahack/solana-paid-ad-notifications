# PRD — Paid Agent Advertisement Notifications

## Executive Summary
A **web2.5 paid-attention system** where users opt in, advertisers pay for attention via Solana, and the app shows notifications only after payment is confirmed.

## Problem
As AI agents scale outreach, unsolicited messages become effectively free for senders and costly for recipients (time, trust, attention).

## Product Thesis
Make attention **economically gated**:
- recipients control whether they receive paid ads,
- senders must pay to reach them,
- the app only delivers ad notifications after provable payment.

## MVP Goal (Demo-first)
Show this end-to-end, clearly and reliably:
1. Recipient connects wallet and signs in.
2. Recipient opts in (no recipient payment required).
3. Advertiser initiates a paid ad request.
4. Advertiser sends Solana payment.
5. Backend confirms payment and maps it to request.
6. Recipient sees popup notification tied to that paid request.

## Scope Pivot (from podcast feedback)
The MVP is **website-first**, not protocol-maximal:
- **Off-chain**: auth, preferences, routing, notifications, analytics, campaign state.
- **On-chain**: payment settlement + public proof.

## Real vs Representative for Hackathon
### Must be real
- wallet auth by signature,
- advertiser-funded on-chain transfer,
- tx detection + linkage to ad request,
- popup delivery UX.

### Can be representative
- advanced targeting,
- complex anti-spam reputation,
- deep analytics,
- batching optimizations,
- full decentralized delivery.

## Product UX Expectations
- Recipient onboarding should be fast and free.
- Payment should be visible and auditable.
- Controls should prioritize user autonomy (opt-in, category filtering, quiet hours).

## Ethics / attention safety
The product should avoid turning users into passive notification inventory:
- explicit opt-in,
- clear payment disclosure,
- configurable limits and quiet windows,
- easy dismiss/block controls.

## Post-hackathon direction
- optional smart-contract mediated ad payment semantics,
- batched payouts,
- paid agent skill marketplace integrations (for monetized gateways).