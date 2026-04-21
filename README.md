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

## Wallet Connect + Registration Demo Web UI
A minimal demo page is available in `web/`.

What it does:
- Connect Phantom wallet
- Register the wallet on-chain via `upsert_policy`
- Verify registration by reading the policy PDA back from devnet

Run it locally:
```bash
cd web
python3 -m http.server 8080
```
Then open:
- `http://localhost:8080`

Requirements:
- Phantom wallet installed in browser
- Wallet set to **Devnet**
- Some devnet SOL for transaction fee

## GitHub Pages (Hosted Wallet Demo)
This repo includes a GitHub Actions workflow that deploys `web/` to GitHub Pages.

Workflow:
- `.github/workflows/deploy-pages.yml`

One-time setup in GitHub:
1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source = GitHub Actions**
3. Run workflow **Deploy Web Demo to GitHub Pages** (or push to `main` with changes in `web/`)

Expected URL:
- `https://watsoncsulahack.github.io/solana-paid-ad-notifications/`

Public access note:
- Repo visibility is public and Pages is configured with `build_type=workflow`, so the site should load on devices even when not signed into GitHub.
- If a device still sees stale content, hard refresh or open in an incognito/private tab.

At that URL, Phantom wallet connect should work over HTTPS.

Additional page (separate wallet app):
- `https://watsoncsulahack.github.io/solana-paid-ad-notifications/wallet-app.html`
- This app can generate/import a demo wallet and bridge signing/transfer requests via `BroadcastChannel` to the main app.

## Web2.5 MVP (Pivot Implementation)
A backend-driven web2.5 demo is included under `web25/`.

What it implements:
- Wallet signature authentication (recipient + advertiser roles)
- Recipient opt-in and preferences (off-chain)
- Advertiser ad request creation (off-chain)
- Advertiser on-chain payment (devnet transfer)
- Backend tx signature mapping and confirmation checks
- Recipient popup-style paid ad notifications after payment confirmation
- Agent Gateway scaffold endpoints for paid skill offerings:
  - `GET /api/agent/health`
  - `POST /api/agent/skills`
  - `GET /api/agent/skills`
  - `POST /api/agent/quote`
  - `POST /api/agent/execute`

Run locally:
```bash
npm install
npm run web25:start
```
Then open:
- `http://localhost:8787`

## Docs
- `docs/PRD.md`
- `docs/SRD.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRACT_DEVNET_MINIMAL.md`
- `docs/CI_DEPENDENCY_PINNING.md`
