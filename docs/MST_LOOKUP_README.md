# MST Statement Lookup

A small standalone page, at `/lookup/`, that fetches one transparent statement from a Microsoft Signing Transparency (MST) ledger and verifies it in the browser. It takes the **ledger name** and a search, chosen with a **Search by** selector:

- **Transaction ID** (the one returned when the statement was registered): answered by the ledger, for any ledger. Opens the verified result.
- **Issuer**, **subject** or **payload hash**: answered by the mst-indexer, only for ledgers onboarded to it. Lists matching entries; opening one verifies it.

The search is kept in the URL so a result can be shared:

```
https://microsoft.github.io/CCF-Ledger-Explorer/lookup/?ledger=<ledger>&tx=<view>.<seqno>
https://microsoft.github.io/CCF-Ledger-Explorer/lookup/?ledger=<ledger>&subject=<text>
https://microsoft.github.io/CCF-Ledger-Explorer/lookup/?ledger=<ledger>&issuer=<text>
https://microsoft.github.io/CCF-Ledger-Explorer/lookup/?ledger=<ledger>&hash=<sha256>
```

The page is a second Vite entry (`lookup/index.html`, `src/lookup/`). It shares the explorer's build, React, Fluent UI and TanStack Query, but loads none of its database, parser or worker code.

## What it shows

- A verdict, one of three kinds:
  - **Verified**.
  - Failed: **Signing keys do not match the ledger identity**, **Receipt is for a different transaction**, **Issuer signature does not verify**, **Signing certificate chain is invalid**, or **Receipt does not verify**.
  - Cannot evaluate: **Cannot evaluate** (a check did not run, or the verifier's output is missing a fact), **Receipts name more than one transaction**, or **Receipt does not name the transaction**.
- Statement facts: issuer and subject (CWT claims), issued-at, content type, algorithm, signer certificate chain, chain validation, and the issuer signature check. The chain is validated only up to the root the statement carries, so a valid chain is internally consistent, not anchored to a root you trust. As in the CLI, an invalid chain fails the verdict; an unsupported or incomplete chain is shown as a gap.
- Receipt facts: transaction ID, registration time, transparency service, signing key ID, and the signature and binding checks. When a statement carries several receipts, the card shows the one that verified.
- The trust anchor: the service certificate digest and the key it binds.
- A payload preview, or the artifact digest for a hash envelope.
- **Decode a payload claim:** for a JSON payload, decodes one named base64 or base64url field, such as a CCE policy in `security-policy-base64`. This is the same as `scitt-verifier inspect --decode <path> --decode-as <encoding>` and uses the same Rust code. The page shows the decoded length, the SHA-256 of the exact decoded bytes, and the content, and lets you download the bytes. If the payload publishes `<name>-sha256` beside a top-level `<name>-base64` field, the page compares the two. The form is prefilled from a top-level key name ending in `-base64` or `-base64url`, but nothing is decoded until you ask. Decoding checks nothing; the bytes have the same status as the statement. The card only appears for JSON payloads; any other embedded payload can be downloaded as its exact bytes from the Payload card.
- Downloads of the statement, key set and service certificate, to check offline with [scitt-verifier](https://github.com/microsoft/scitt-verifier).

A check that did not run is shown as "not evaluated", never as a pass.

## Trust model

The browser cannot reach a ledger directly: the ledger's TLS certificate is issued by the ledger itself, and it sends no CORS headers. The page therefore reads from two Azure services:

| What | From | Trusted for |
|---|---|---|
| Service certificate | Identity service, `GET https://centraluseuap.identity.confidential-ledger.core.azure.com/ledgerIdentity/{ledger}` (`ledgerTlsCertificate`) | The trust anchor, over the public web PKI |
| Signing key set | Control-plane proxy, `GET https://centraluseuap.controlplane.confidential-ledger.core.azure.com/api/Proxy/{ledger}/.well-known/scitt-keys` | Nothing |
| Statement | Control-plane proxy, `GET .../api/Proxy/{ledger}/entries/{txId}/statement` | Nothing |
| Search results | mst-indexer, `GET https://centraluseuap.identity.confidential-ledger.core.azure.com/odata/ledgers/{ledger}/entries?$filter=...` | Nothing |

The statement endpoint requires the full `<view>.<seqno>`, so there is no search by bare sequence number: scitt-ccf-ledger is removing the `/entries/txIds` listing that resolved one ([microsoft/scitt-ccf-ledger#476](https://github.com/microsoft/scitt-ccf-ledger/pull/476)). For an indexed ledger, an issuer, subject or payload-hash search lists each entry's transaction ID.

### Searching the index

Issuer, subject and payload-hash searches query the mst-indexer read API, hosted on the identity service. Only ledgers onboarded to the indexer can be searched this way. Any other ledger answers `404` `LedgerNotIndexedHere`, and the page says the ledger is not indexed and suggests a transaction ID instead. A ledger name that does not exist answers `404` `LedgerNotFound`, shown as "Ledger not found". The page does not keep a list of indexed ledgers; it just tries the search.

- **Issuer** and **subject** match any value containing the text (`contains`, case-sensitive). The indexer allows substring search only on these two columns.
- **Payload hash** is an exact match on the SHA-256 of the statement's embedded payload, the same value the result page shows. For a hash envelope that payload is already the artifact's digest, so this is the hash of the digest, not of the artifact file.
- Results are newest first, 20 per page, with **Load more**. The indexer returns a bare array without a count or next link, so the page asks for one extra row to tell whether another page exists. Each page starts below the last sequence number shown (`SequenceNo lt <n>`) instead of using `$skip`. That avoids the indexer's 10,000-row `$skip` limit, and entries indexed while you page don't repeat rows. Rows that share a sequence number are kept on the same page; if they alone fill a page, the page fetches all of them (up to 500) with `SequenceNo eq <n>`.

Index rows are pointers, not evidence. The list says so, and each entry is fetched from the ledger and verified only when it is opened.

Verification uses only the key in the served key set whose key ID matches the service certificate's public key (`verifyStatementWithServiceCert` in scitt-wasm). If the key set does not contain that key, nothing is verified. Receipts signed by other keys, for example ones in use before a key rotation, are reported as "cannot evaluate" rather than trusted. The page also checks that the receipt covers the requested transaction. It reads the entry's transaction ID from the receipt's CCF commit evidence (`ce:<view>.<seqno>:<nonce>`), which the receipt's Merkle leaf commits to. The receipt's own `txid` header is the later signature transaction and is shown for information only.

scitt-wasm does not yet report which receipt verified or which transaction a verified receipt names, so the page is strict when a statement carries more than one receipt: every receipt must name the requested transaction. Otherwise the verdict is "Receipt is for a different transaction" (no receipt names it) or "Receipts name more than one transaction" (some do), even if one receipt verifies. Transaction IDs are compared after removing leading zeros, so `02.0100` and `2.100` are the same entry.

A lookup sends its requests in parallel. If more than one fails, the page reports the identity service's error first, since it is the one that tells a mistyped ledger name apart from a missing entry, and cancels the requests still running.

While a ledger loads a historical entry into its cache it answers `503` `TransactionNotCached`. The control-plane proxy also forwards hop-by-hop headers to the ledger, which intermittently makes the ledger reject a request with a `400` HTTP parse error. The page retries both for a few seconds, and reports either as a temporary outage if it persists. `404` means an unknown ledger or entry, `401`/`403` a ledger that does not allow unauthenticated reads, and `410` that the proxy is disabled.

## Running locally

```bash
npm run dev
# open http://localhost:5173/lookup/?ledger=<ledger>&tx=<txId>
```

Neither service sends CORS headers for `localhost`, so in development the page calls `/mst-dev/proxy`, `/mst-dev/identity` and `/mst-dev/indexer`, which the Vite dev server forwards to the canary hosts (see `vite.lookup-proxy.ts`). The hosts are defined once, in `src/lookup/config/endpoints.ts`.

## Production dependency

A production build calls these services directly from the browser. That works only from origins the services' CORS policy allows: `https://microsoft.github.io` and `https://vibehub.microsoft.com`. Other origins, including Azure Static Web Apps deployments of the explorer and forks published to other GitHub Pages accounts, are not supported, so the main build includes the lookup page only for GitHub Pages (`DEPLOY_TARGET=github-pages`). The page uses the canary (`centraluseuap`) hosts of both services, which allow these origins; the global hosts route to regions that may not yet. Switch the defaults to the global hosts once every region allows them. Endpoints can be overridden at build time; the page header then shows "custom endpoints" instead of "canary":

| Variable | Default (production) |
|---|---|
| `VITE_MST_PROXY_BASE` | `https://centraluseuap.controlplane.confidential-ledger.core.azure.com/api/Proxy` |
| `VITE_MST_IDENTITY_BASE` | `https://centraluseuap.identity.confidential-ledger.core.azure.com/ledgerIdentity` |
| `VITE_MST_INDEXER_BASE` | `https://centraluseuap.identity.confidential-ledger.core.azure.com/odata/ledgers` |
| `VITE_EXPLORER_URL` | `../` (target of the "CCF Ledger Explorer" footer link) |

Both builds read these from the environment or from `.env*` files at the repository root.

## Standalone build

`npm run build:lookup` builds only the lookup page into `dist-lookup/` (`vite.lookup.config.ts`), with `index.html` at the root and relative asset URLs, so it can be served from any sub-path on an allowed origin, such as a VibeHub app. CI runs it on every push. Set `VITE_EXPLORER_URL` so the footer link points at the explorer:

```powershell
$env:VITE_EXPLORER_URL = 'https://microsoft.github.io/CCF-Ledger-Explorer/'
npm run build:lookup
```

## The vendored verifier

`src/lookup/vendor/scitt-wasm/` is a `wasm-pack --target web` build of `scitt-wasm` from microsoft/scitt-verifier (MIT), vendored because it is not published to npm. Its README records the source commit, crate version, file hashes and rebuild steps. It is excluded from ESLint, and `.gitattributes` keeps Git from changing its line endings. The lookup tests check the vendored files against the README's hashes and crate version, and verify the scitt-verifier corpus fixtures with the vendored build; the page also refuses to run a build whose `version()` differs. After updating it, update the README and `SCITT_WASM_VERSION` in `scitt-wasm-loader.ts`, then run:

```bash
npx vitest run src/__tests__/lookup
```

## Code layout

| Path | Purpose |
|---|---|
| `lookup/index.html`, `src/lookup/main.tsx` | Entry point |
| `src/lookup/pages/LookupPage.tsx` | Page |
| `src/lookup/components/` | Form, result view and index search results |
| `src/lookup/hooks/use-mst-lookup.ts` | Query hooks, query keys, URL state |
| `src/lookup/config/endpoints.ts` | Canary service hosts, shared with the dev proxy |
| `src/lookup/services/mst-lookup-service.ts` | Fetching, retries, error mapping, verification |
| `src/lookup/services/indexer-search-service.ts` | mst-indexer search |
| `src/lookup/services/scitt-wasm-loader.ts` | WASM initialisation |
| `src/lookup/utils/lookup-verdict.ts` | Input parsing and verdict |
| `src/lookup/utils/claim-decode.ts` | Payload claim decoding |
| `src/__tests__/lookup/` | Tests and fixtures |
