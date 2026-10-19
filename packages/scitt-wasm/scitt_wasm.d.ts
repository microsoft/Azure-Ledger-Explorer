/* tslint:disable */
/* eslint-disable */

/**
 * Compare an artifact against what a statement says about it.
 *
 * This is the check that turns "the statement is genuine" into "the statement
 * is about the file I am holding" — two claims that are routinely confused
 * and that fail independently. A statement can verify perfectly and describe
 * something else entirely.
 *
 * The comparison itself is `scitt_receipt::bind`, the same code path the
 * command-line tool takes. Reimplementing it here in JavaScript was the
 * obvious shortcut and the wrong one: a browser and a pipeline that disagreed
 * about a hash envelope or a detached payload would surface the disagreement
 * as a release that should have been stopped.
 *
 * `mode` is required and never inferred from the statement. Choosing
 * `payload-digest` for the caller because the statement happens to be a hash
 * envelope would report a relationship the operator never asserted; the CLI
 * refuses to guess for the same reason.
 *
 * Three outcomes, and the third is the one that matters most:
 *
 * - `bound` — the artifact is the one the statement describes.
 * - `mismatch` — it is not. This is a finding about the artifact.
 * - `cannotCompare` — the question could not be answered: a detached payload,
 *   a mode that does not fit, or a hash this build cannot compute. This is a
 *   fact about the comparison, **not** about the artifact, and a caller that
 *   renders it as a failure is accusing an operator of shipping the wrong
 *   file when the real fault is the request.
 */
export function bindArtifact(statement: Uint8Array, artifact: Uint8Array, mode: string, artifact_name: string): string;

/**
 * Convenience for callers that only need the identity of the bytes, such as a
 * ledger explorer matching a statement against a transaction it already holds.
 */
export function claimDigest(statement: Uint8Array): string;

/**
 * Decode one encoded claim inside a JSON payload, and report its digest.
 *
 * The browser counterpart of `inspect --decode`, reading the claim through
 * the same extraction (`scitt_policy::claim::encoded_claim_bytes`), so a
 * digest shown on a page and one printed in CI are over the same bytes by
 * construction.
 *
 * `path` is written the way `inspect` prints it, `['security-policy-base64']`.
 * `encoding` is `base64` or `base64url` and is required: nothing is decoded
 * that the caller did not name, and no encoding is guessed from the value.
 *
 * Decoding is not verification. The bytes inherit whatever status the
 * statement has, and a page that shows this beside a failed signature must
 * not let the digest read as an endorsement.
 *
 * A claim that cannot be read — a detached or non-JSON payload, a path that
 * reaches nothing, a value that is not the named encoding — is an exception
 * whose message is a sentence about this statement.
 */
export function decodeClaim(statement: Uint8Array, path: string, encoding: string): string;

/**
 * Describe a single certificate in isolation, for a UI that lets a user click
 * into a chain entry.
 */
export function describeCertificate(index: number, der: Uint8Array): string;

/**
 * Describe a bare receipt blob that arrived outside a statement.
 */
export function describeReceipt(receipt: Uint8Array): string;

/**
 * Evaluate a caller-supplied relying-party policy over a statement's facts.
 *
 * ## Why this is not a verdict
 *
 * The return value is one `outcome` per assertion, plus the three aggregate
 * predicates those outcomes support. It is not a pass/fail for the statement,
 * and there is no field here that a caller can render as one. Turning
 * outcomes into a verdict is `decide()`'s job in `scitt-verifier`, and the
 * equivalent choice belongs to whoever consumes this — which is the same
 * division of labour the rest of this crate observes.
 *
 * ## Why it re-verifies rather than taking facts back from JavaScript
 *
 * Policy is evaluated over `StatementFacts`, and the only trustworthy source
 * of those is this module. Accepting them back across the boundary as JSON
 * would let a page evaluate policy against facts it had edited, which is a
 * verifier that can be talked out of its own findings. Re-deriving them costs
 * a few milliseconds and keeps every call stateless — no handles to leak, and
 * a re-evaluation loop that cannot drift from the bytes it started with.
 *
 * `now` is a Unix timestamp in seconds, supplied by the caller because the
 * core does not read the clock. Pass `Math.floor(Date.now() / 1000)` for live
 * use, or a fixed value to make a run reproducible — the same reason the CLI
 * offers `--now`.
 *
 * It is taken as a `f64` rather than an `i64` so that callers pass a plain
 * number instead of a `BigInt`; seconds since the epoch are nowhere near
 * `Number.MAX_SAFE_INTEGER`, so nothing is lost. A non-integral or non-finite
 * value is rejected rather than truncated: `now` decides freshness, and a
 * clock that is silently wrong is worse than one that refuses.
 *
 * `trustedRoots` is as for `verifyStatement`. Pass the same value to both, or
 * `certificateChainValidated` and `requireChainToRootSha256` will be answered
 * about a different chain from the one the page displays.
 *
 * `serviceCert` is as for `verifyStatementWithServiceCert`, and restricts the
 * key set the same way. A page that verified through the service certificate
 * must pass it here too; otherwise policy is evaluated over receipts checked
 * against keys the page itself just declined to trust. A key set holding no
 * key bound to the certificate is an exception here, because there are no
 * facts to evaluate; `verifyStatementWithServiceCert` reports it as a result.
 */
export function evaluatePolicy(statement: Uint8Array, key_set: Uint8Array, policy: Uint8Array, now: number, trusted_roots?: string | null, service_cert?: string | null): string;

/**
 * Describe a statement without trust material.
 *
 * Answers "what is in this file?" and deliberately not "should I trust it?".
 * Nothing here is evidence: with no key set, no receipt signature can be
 * checked, so every verification field is absent rather than false.
 */
export function inspectStatement(statement: Uint8Array): string;

/**
 * The statement's payload, decoded for display.
 *
 * Split out rather than folded into `inspectStatement` because payloads are
 * routinely large — a hardware BOM statement can carry tens of KB of SPDX — and a
 * caller rendering a summary should not have to receive and discard the whole
 * document to do it.
 *
 * Two distinctions are load-bearing:
 *
 * **A detached payload is not an empty one.** `{"detached": true}` means the
 * bytes travel separately, so there is nothing here to show and nothing has
 * gone wrong. Rendering that as an empty document would invite the reader to
 * conclude the statement says nothing.
 *
 * **A hash envelope's payload is a digest, not content** (RFC 9995). For one
 * of those, `sha256` is deliberately absent: it would be the hash of a hash —
 * a number that looks exactly like the artifact digest a reader is hunting
 * for, sitting next to a field called `sha256`, and it identifies nothing. The
 * digest itself is published under `hashEnvelope.digest` instead, which is the
 * value that actually means something.
 */
export function statementPayload(statement: Uint8Array): string;

/**
 * Verify a transparent statement against a COSE_KeySet.
 *
 * The key set is deliberately not scoped to an issuer. A receipt from some
 * other transparency service is signed by *that* service's key, so it fails
 * signature verification here on its own merits. Which issuer a caller is
 * willing to accept is a policy question, and the receipt's `issuer` is
 * reported below for the caller to assert on.
 *
 * Returns a JSON document. Errors are returned as JS exceptions only when
 * nothing could be established at all; a statement that parses but fails
 * verification is a *result*, not an error, and callers must render it.
 *
 * `trustedRoots` is optional PEM holding one or more CA certificates. Without
 * it the signing chain is still validated, but only to the root the statement
 * itself carries, and `chainValidation.anchoredExternally` says so. With it,
 * the chain must lead to one of those roots. Roots that cannot be read are an
 * exception, not a result: running the weaker check under the stronger
 * request would report something nobody asked for.
 */
export function verifyStatement(statement: Uint8Array, key_set: Uint8Array, trusted_roots?: string | null): string;

/**
 * Verify a statement using only the key the service certificate vouches for.
 *
 * For a page that fetched the key set through a channel it cannot
 * authenticate, such as a proxy in front of a ledger whose TLS certificate a
 * browser will not accept. The service certificate comes from somewhere the
 * page *can* authenticate, typically the identity service over the public web
 * PKI, and is the only trust anchor here. The command-line tool gets the same
 * assurance by pinning the ledger connection to that certificate; a browser
 * cannot pin, so the binding is checked over the bytes instead.
 *
 * Two consequences:
 *
 * - The key set must contain exactly one entry whose `kid` is the hash of the
 *   certificate's public key and whose material hashes to that `kid`. If it
 *   does not, nothing is verified and `serviceKey.bound` is `false` with a
 *   `mismatch` code. This is a finding about the key set, and is returned as
 *   a result rather than an exception so a page can render it.
 * - Every other key in the set is discarded before verification. Whoever
 *   served the set could have added one, so a receipt signed by any other key
 *   (for example one that predates a disaster recovery) is reported as an
 *   unknown `kid` and left unevaluated, never verified.
 *
 * `serviceCert` is PEM holding exactly one certificate: the
 * `ledgerTlsCertificate` field of the identity service's response.
 * `trustedRoots` is as for `verifyStatement`, and anchors the *signer's*
 * chain; it has nothing to do with the service certificate.
 */
export function verifyStatementWithServiceCert(statement: Uint8Array, key_set: Uint8Array, service_cert: string, trusted_roots?: string | null): string;

/**
 * The verification core's version, so a page can report what verified it.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly bindArtifact: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly claimDigest: (a: number, b: number, c: number) => void;
    readonly decodeClaim: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly describeCertificate: (a: number, b: number, c: number, d: number) => void;
    readonly describeReceipt: (a: number, b: number, c: number) => void;
    readonly evaluatePolicy: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly inspectStatement: (a: number, b: number, c: number) => void;
    readonly statementPayload: (a: number, b: number, c: number) => void;
    readonly verifyStatement: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly verifyStatementWithServiceCert: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly version: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
