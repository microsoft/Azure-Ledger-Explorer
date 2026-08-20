# @microsoft/scitt-wasm

Prebuilt WebAssembly build of the verification core from
[microsoft/scitt-verifier](https://github.com/microsoft/scitt-verifier).

**This directory contains generated artifacts. Do not edit them by hand.**
The source lives in `crates/scitt-wasm` in that repository.

## What it is

`scitt-receipt` is the crate that answers one question about a pile of bytes:

> Was this exact statement registered on this ledger, and does it describe the
> artifact I am about to deploy?

It performs no I/O, never reads the clock, and returns no verdicts — a
discipline enforced by a CI job in the upstream repository, and the reason it
can be compiled for a browser at all. `crates/scitt-wasm` is the browser's
consumer layer over it, playing the same role the CLI plays for a terminal.

## What it is *not*

This does **not** replace anything in `src/utils/receipt-verification.ts` or
`src/workers/verification-worker.ts`. Those verify Azure Confidential Ledger
write receipts and whole-ledger Merkle integrity — a different artifact from a
SCITT transparent statement. The three verifiers are deliberately separate.

## Regenerating

Requires a Rust toolchain with the `wasm32-unknown-unknown` target and
`wasm-pack`. On Windows the host toolchain must be able to link proc-macros;
`stable-x86_64-pc-windows-gnu` works without Visual Studio.

```console
rustup target add wasm32-unknown-unknown
cd <scitt-verifier>/crates/scitt-wasm
wasm-pack build --target web --out-dir pkg-web --release
```

Then copy `scitt_wasm.js`, `scitt_wasm.d.ts`, `scitt_wasm_bg.wasm` and
`scitt_wasm_bg.wasm.d.ts` here.

The build is pinned to the `crypto_pure_rust` backend. That backend is
synchronous, which is what keeps `verifyStatement` a plain function call:
WebCrypto's `SubtleCrypto` is async-only, so a WebCrypto build would make the
entire call stack async, up through every caller in this app.

## Prototype status

Checking a 538 KB binary into the repository is a deliberate prototype
shortcut, so the demo works without a Rust toolchain. Before this ships it
should come from a versioned release artifact instead — see
`docs/distribution.md` upstream, which tracks npm + WASM as a distribution
channel.
