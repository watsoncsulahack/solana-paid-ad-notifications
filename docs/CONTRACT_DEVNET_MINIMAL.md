# Minimal Devnet Contract (Anchor)

Implemented initial on-chain MVP contract scaffold:

- `RecipientPolicy` PDA: recipient-configurable fee + category policy
- `AdNotificationRequest` PDA: paid request record by sender
- `upsert_policy` instruction
- `submit_ad_request` instruction (includes lamport transfer sender -> recipient)
- `update_request_status` instruction (recipient-only)

## Program location
- `programs/paid_ad_notifications/src/lib.rs`

## Devnet config
- Program registered in `Anchor.toml` under `[programs.devnet]`
- Provider cluster set to `Devnet`

## Next steps
1. Generate/finalize real program ID from deploy keypair.
2. Run `anchor build` and `anchor deploy --provider.cluster devnet` in an environment with Anchor + Rust toolchain installed.
3. Add integration tests for policy and request lifecycle.
