# SRD — Paid Agent Advertisement Notifications

## Stack (MVP)
- Frontend: static web app (GitHub Pages)
- Backend: Node.js + Express (`web25/server.js`)
- Chain: Solana Devnet
- Wallets: Phantom + wallet-router fallback web app
- Data store (MVP): local JSON

## Functional Requirements
1. Wallet signature auth for recipients and advertisers.
2. Recipient free opt-in with saved preferences.
3. Advertiser can create ad request with payment amount.
4. Advertiser submits tx signature after transfer.
5. System confirms on-chain transfer and matches source/destination/amount.
6. Notification record is created and visible to recipient.

## Agent Skill Monetization Scaffold
- `POST /api/agent/skills`: publish skill + base lamport price
- `POST /api/agent/quote`: return execution quote
- `POST /api/agent/execute`: require verified payment before execution

## Non-functional Priorities
- Demo reliability > perfect architecture
- Explainability of flow for judges
- Fast recovery from wallet/provider edge cases

## Constraints
- Hackathon deadline: focus on critical narrative path
- Accept representative implementations where needed

## Expected Demo Output
- clear proof of wallet-authenticated recipient participation,
- clear proof of advertiser payment,
- clear proof of payment-triggered notification delivery,
- clear monetization path via paid agent skill API.