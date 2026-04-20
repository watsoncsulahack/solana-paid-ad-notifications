# CI Dependency Pinning Strategy (Option 2)

This repo uses a vendored + frozen Cargo strategy for Anchor SBF builds.

## Why

`cargo-build-sbf` in the Solana 1.18.x toolchain uses an older Cargo path.
If CI resolves newer crates that require `edition2024`, metadata/build can fail before compiling our program.

## What we changed

1. Added `vendor/` with `cargo vendor --locked` output.
2. Added `.cargo/config.toml` source replacement:

```toml
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
```

3. Updated CI build step to force no network resolution and exact lock use:

- `CARGO_NET_OFFLINE=true`
- `anchor build -- -- --frozen --locked`

## Expected behavior

- Build does not hit crates.io during SBF compile.
- Cargo dependency graph is exactly what is committed in `Cargo.lock` + `vendor/`.
- No surprise upgrades to edition2024-only transitive crates.

## Maintenance

When intentionally updating dependencies:

```bash
cargo update
cargo vendor --locked vendor > .cargo/config.toml
```

Then commit all of:
- `Cargo.lock`
- `vendor/`
- `.cargo/config.toml`

## Next step (Option 1)

Long-term, migrate to a Solana/Anchor toolchain combo whose SBF build path uses a newer Cargo, then remove heavy vendoring if desired.
