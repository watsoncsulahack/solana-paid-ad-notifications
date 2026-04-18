# Solana Paid Ad Notifications
## Tech Stack Options + MVP Build Roadmap (for external review)

**Purpose:** This document compiles recommended implementation stacks and an execution roadmap for building the hackathon MVP.

**Project context:** Recipient-controlled, paid ad notifications for wallet users. Agents/advertisers must pay to submit an ad-notification request. A watcher surfaces policy-compliant requests to the recipient app.

---

## 1) MVP scope and guardrails

### In scope (MVP)
- Recipient policy creation/update
- Paid ad request submission
- On-chain recording of policy and request metadata
- Off-chain watcher/indexer for delivery checks
- Recipient notification UI (open/dismiss/block)

### Out of scope (MVP)
- Full sender reputation enforcement
- x402 integration (optional phase 2)
- ZK delivery/receipt proofs
- Privacy-preserving recipient obfuscation
- Fully decentralized push-notification transport

---

## 2) Tech stack options

## Option A: Standard Solana dApp stack (Recommended)

### Components
- **Smart contract:** Anchor (Rust)
- **Frontend:** Next.js + TypeScript + Tailwind
- **Wallet integration:** `@solana/wallet-adapter`
- **RPC/indexing provider:** Helius (or QuickNode)
- **Watcher/API:** Node.js + Fastify (or Express)
- **Operational DB:** Supabase Postgres
- **Deploy:** Vercel (frontend) + Railway/Fly/Render (backend)

### What this option is
A conventional, proven Solana stack used by many hackathon teams. It separates concerns cleanly between on-chain logic, off-chain processing, and web UI.

### Why suggested
- Fastest path to a credible MVP
- Strong ecosystem support and docs
- Easy to debug and demo
- Lets you keep program logic minimal while delivery logic evolves off-chain

### Tradeoffs
- More moving parts than serverless-only setups
- Requires basic ops coordination between frontend/backend/RPC

---

## Option B: Lean/serverless-heavy stack

### Components
- **Smart contract:** Anchor (Rust)
- **Frontend:** Next.js + TypeScript
- **Wallet integration:** `@solana/wallet-adapter`
- **RPC/indexing:** Helius webhooks/enhanced APIs
- **Watcher/API:** Supabase Edge Functions (or serverless functions)
- **State:** Supabase Postgres
- **Deploy:** Vercel + Supabase

### What this option is
A reduced-ops architecture that pushes watcher and API logic toward serverless and managed services.

### Why suggested
- Simpler ops burden
- Lower setup complexity for solo builder
- Good if infra time is limited

### Tradeoffs
- Less control over long-running workers and retries
- Harder to tune event-processing reliability under burst load

---

## Option C: Android-first client with standard backend

### Components
- **Smart contract:** Anchor (Rust)
- **Client app:** Android (Kotlin) or hybrid WebView shell
- **Wallet flow:** deeplink/wallet adapter strategy
- **Watcher/API:** Node.js service (same as Option A)
- **RPC/indexing:** Helius/QuickNode
- **State:** Postgres/Supabase

### What this option is
A mobile-primary user experience while keeping backend and on-chain stack standard.

### Why suggested
- Strong mobile demo appeal
- Reuses your Android familiarity
- Good for wallet-first interaction narrative

### Tradeoffs
- Highest implementation risk for deadline
- Wallet UX on Android can add edge-case complexity

---

## Recommendation
**Use Option A** for highest confidence before Monday.

Reason: It balances reliability, familiarity, and speed of implementation while preserving clean architecture boundaries.

---

## 3) Suggested architecture for MVP

- **On-chain:** Source of truth for recipient policy + paid request records
- **Off-chain watcher:** Detects requests and checks policy delivery rules
- **Recipient app/UI:** Shows notifications and allows actions
- **Agent submit client:** Reads policy and submits paid request tx

Key principle: Keep the chain state canonical and minimal; keep delivery logic flexible off-chain.

---

## 4) Step-by-step MVP roadmap

## Phase 0 — Scope lock (1–2 hours)
1. Freeze MVP feature list.
2. Freeze non-goals.
3. Define one demo story end-to-end.

Deliverable: Signed-off scope checklist.

---

## Phase 1 — On-chain program core (0.5 day)
1. Scaffold Anchor program.
2. Implement `RecipientPolicy` account and upsert instruction.
3. Implement `AdNotificationRequest` account and paid submit instruction.
4. Enforce payment requirement and basic policy gating fields.
5. Add tests: success, underpayment, disabled policy.

Deliverable: Program + tests passing on local/devnet.

---

## Phase 2 — Watcher + API (0.5 day)
1. Build watcher service that tracks new requests.
2. Apply policy-compliance checks needed for notification delivery.
3. Persist delivery status in Postgres.
4. Expose recipient endpoints for list/open/dismiss/block actions.

Deliverable: Working delivery pipeline with observable statuses.

---

## Phase 3 — Frontend recipient + sender flows (0.5 day)
1. Recipient UI: wallet connect, policy management.
2. Recipient UI: notification list + open/dismiss/block.
3. Sender/agent submit UI or script: read policy, pay+submit request.

Deliverable: Human-usable end-to-end app flow.

---

## Phase 4 — Reliability and polish (0.5 day)
1. Retry/backoff in watcher.
2. Clear error states in UI.
3. Logging for tx signature, request id, delivery state.
4. Basic abuse controls (rate-limits per sender in watcher layer).

Deliverable: Stable demo behavior under repeated trials.

---

## Phase 5 — Demo packaging (2–4 hours)
1. Demo script (60–120 seconds) with deterministic flow.
2. README update with architecture and scope disclaimers.
3. Architecture diagram and MVP-vs-roadmap section.
4. Record one clean dry-run video.

Deliverable: Submission-ready package.

---

## 5) Core data model (MVP)

### RecipientPolicy (on-chain)
- recipient_wallet
- enabled
- min_fee_lamports
- max_notifications_per_period
- allowed_categories
- updated_at_slot

### AdNotificationRequest (on-chain)
- request_id
- recipient_wallet
- sender_wallet_or_agent_id
- fee_paid_lamports
- category
- content_uri_or_hash
- created_at_slot
- status

### DeliveryRecord (off-chain)
- request_id
- recipient
- delivered_at
- action (`opened`, `dismissed`, `blocked`)

---

## 6) Risks and mitigation

1. **Wallet UX friction**
   - Mitigation: keep a minimal tx flow and clear UI guidance.

2. **RPC instability**
   - Mitigation: provider fallback and retry policy.

3. **Watcher lag/missed events**
   - Mitigation: backfill scan + idempotent processing.

4. **Spam optics**
   - Mitigation: clear recipient controls + sender block + policy gating.

---

## 7) Why this roadmap is hackathon-feasible

- Scope is intentionally narrow.
- Core trust anchors are on-chain and auditable.
- Off-chain parts are practical and easy to iterate quickly.
- The system demonstrates a real user problem + economic mechanism + technical credibility.

---

## 8) Optional phase-2 expansions (post-MVP)

- x402 API path for agent submissions
- sender reputation ratings and policy filters by reputation
- campaign analytics dashboard
- privacy-preserving delivery pathways
- optional ZK-based delivery/receipt proofs

---

## 9) Suggested final decision

If deadline is strict, build **Option A** with the roadmap above and avoid expanding scope beyond MVP.

This provides the strongest chance of delivering a complete, demoable system by Monday.
