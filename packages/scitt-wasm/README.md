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

## Version

Built from [`v0.5.0`](https://github.com/microsoft/scitt-verifier/releases/tag/v0.5.0)
(`5e6ebb7797cedc0d2c698b3a03aec0e7118bcd99`) with wasm-pack 0.13.1, the
version upstream CI pins. The upstream conformance harness
(`crates/scitt-wasm/tests/corpus.node.mjs`) passes against the same build.

`src/types/scitt-types.ts` mirrors this version's JSON. When regenerating from
a newer tag, diff `scitt_wasm.d.ts` and the JSON mapping in upstream
`crates/scitt-wasm/src/lib.rs`, and update the types, the worker and
`e2e/test_files/scitt` (from upstream `corpus/fixtures`) together.

## Regenerating

Requires a Rust toolchain with the `wasm32-unknown-unknown` target and
`wasm-pack` 0.13.1. On Windows the host toolchain must be able to link
proc-macros: `stable-x86_64-pc-windows-msvc` with the Visual Studio C++ build
tools, or `stable-x86_64-pc-windows-gnu` without them.

```console
rustup target add wasm32-unknown-unknown
git -C <scitt-verifier> checkout v0.5.0
cd <scitt-verifier>/crates/scitt-wasm
wasm-pack build --target web --out-dir pkg-web --release
```

Then copy `scitt_wasm.js`, `scitt_wasm.d.ts`, `scitt_wasm_bg.wasm` and
`scitt_wasm_bg.wasm.d.ts` here.

On Windows without symlink privileges (Developer Mode off), cargo can exit
silently with status 0 while checking out the `everparse` git dependency,
which contains symlinks under `src/cddl/tests`. Check that revision out with
`git -c core.symlinks=false` into the directory under
`$CARGO_HOME/git/checkouts/` that cargo was populating, create an empty
`.cargo-ok` file there, and re-run the build.

The build is pinned to the `crypto_pure_rust` backend. That backend is
synchronous, which is what keeps `verifyStatement` a plain function call:
WebCrypto's `SubtleCrypto` is async-only, so a WebCrypto build would make the
entire call stack async, up through every caller in this app.

## Distribution

Upstream does not yet publish the WebAssembly build as a release artifact, so
the ~790 KB module is checked in. When upstream ships one (tracked in
`docs/distribution.md` there), this directory should be replaced by a
versioned dependency on it.
