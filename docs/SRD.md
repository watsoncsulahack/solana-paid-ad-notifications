# SRD — Paid Agent Advertisement Notifications

## Stack
- Solana Devnet
- Anchor program
- Off-chain watcher/indexer
- Companion notification UI

## On-chain Accounts
### RecipientPolicy
- recipient_wallet
- enabled
- min_fee_lamports
- max_notifications_per_period
- allowed_categories
- updated_at_slot

### AdNotificationRequest
- request_id
- recipient_wallet
- sender_wallet
- fee_paid_lamports
- category
- content_uri_or_hash
- created_at_slot
- status

## Core Flows
1. Recipient sets policy.
2. Agent submits paid request.
3. Program records request + payment metadata.
4. Watcher checks compliance and sends notification.

## Trust Model (MVP)
- On-chain policy and paid request records are source of truth.
- Notification delivery remains off-chain.

## Deferred Design
- Agent reputation ratings and weighted delivery priority.
