# Vendored scitt-wasm

Browser build of `scitt-wasm` from
[microsoft/scitt-verifier](https://github.com/microsoft/scitt-verifier)
(MIT, see `LICENSE`). The MST lookup page uses it to verify transparent
statements. It is vendored because the crate is not yet published to npm.

Do not edit these files. To update, rebuild from the source and replace all of them.

| Field | Value |
|---|---|
| Source commit | `d47cbb27d8ee5d561a2b6328aee28842c5c007cb` (branch `wasm-demo-refresh`, microsoft/scitt-verifier#41, not yet merged) |
| Crate version | 0.4.0 |
| Toolchain | Rust stable, wasm-pack 0.13.1 |
| `scitt_wasm_bg.wasm` sha-256 | `1e6177ef3d7a30ec483d1fc932b614c730087526e7663007e0192873749b275b` |
| `scitt_wasm.js` sha-256 | `d8bfde942dbb01067783844a2a2eae0612b617e328f62b25fb2987b93f7b6ac8` |

## Rebuilding

```sh
git clone https://github.com/microsoft/scitt-verifier && cd scitt-verifier
git checkout <commit>
cd crates/scitt-wasm
wasm-pack build --target web --release --no-pack --out-dir <tmp>
cp <tmp>/scitt_wasm* <this directory>
```

Then update the table above.
