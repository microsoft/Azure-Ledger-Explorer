/* @ts-self-types="./scitt_wasm.d.ts" */

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
 * @param {Uint8Array} statement
 * @param {Uint8Array} artifact
 * @param {string} mode
 * @param {string} artifact_name
 * @returns {string}
 */
export function bindArtifact(statement, artifact, mode, artifact_name) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(artifact, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(mode, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(artifact_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len3 = WASM_VECTOR_LEN;
        wasm.bindArtifact(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr5 = r0;
        var len5 = r1;
        if (r3) {
            ptr5 = 0; len5 = 0;
            throw takeObject(r2);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred6_0, deferred6_1, 1);
    }
}

/**
 * Convenience for callers that only need the identity of the bytes, such as a
 * ledger explorer matching a statement against a transaction it already holds.
 * @param {Uint8Array} statement
 * @returns {string}
 */
export function claimDigest(statement) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.claimDigest(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

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
 * @param {Uint8Array} statement
 * @param {string} path
 * @param {string} encoding
 * @returns {string}
 */
export function decodeClaim(statement, path, encoding) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(path, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(encoding, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.decodeClaim(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr4 = r0;
        var len4 = r1;
        if (r3) {
            ptr4 = 0; len4 = 0;
            throw takeObject(r2);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Describe a single certificate in isolation, for a UI that lets a user click
 * into a chain entry.
 * @param {number} index
 * @param {Uint8Array} der
 * @returns {string}
 */
export function describeCertificate(index, der) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(der, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.describeCertificate(retptr, index, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Describe a bare receipt blob that arrived outside a statement.
 * @param {Uint8Array} receipt
 * @returns {string}
 */
export function describeReceipt(receipt) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(receipt, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.describeReceipt(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

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
 * @param {Uint8Array} statement
 * @param {Uint8Array} key_set
 * @param {Uint8Array} policy
 * @param {number} now
 * @param {string | null} [trusted_roots]
 * @param {string | null} [service_cert]
 * @returns {string}
 */
export function evaluatePolicy(statement, key_set, policy, now, trusted_roots, service_cert) {
    let deferred7_0;
    let deferred7_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(key_set, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(policy, wasm.__wbindgen_export);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(trusted_roots) ? 0 : passStringToWasm0(trusted_roots, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(service_cert) ? 0 : passStringToWasm0(service_cert, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len4 = WASM_VECTOR_LEN;
        wasm.evaluatePolicy(retptr, ptr0, len0, ptr1, len1, ptr2, len2, now, ptr3, len3, ptr4, len4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr6 = r0;
        var len6 = r1;
        if (r3) {
            ptr6 = 0; len6 = 0;
            throw takeObject(r2);
        }
        deferred7_0 = ptr6;
        deferred7_1 = len6;
        return getStringFromWasm0(ptr6, len6);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred7_0, deferred7_1, 1);
    }
}

/**
 * Describe a statement without trust material.
 *
 * Answers "what is in this file?" and deliberately not "should I trust it?".
 * Nothing here is evidence: with no key set, no receipt signature can be
 * checked, so every verification field is absent rather than false.
 * @param {Uint8Array} statement
 * @returns {string}
 */
export function inspectStatement(statement) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.inspectStatement(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

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
 * @param {Uint8Array} statement
 * @returns {string}
 */
export function statementPayload(statement) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.statementPayload(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred3_0, deferred3_1, 1);
    }
}

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
 * @param {Uint8Array} statement
 * @param {Uint8Array} key_set
 * @param {string | null} [trusted_roots]
 * @returns {string}
 */
export function verifyStatement(statement, key_set, trusted_roots) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(key_set, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(trusted_roots) ? 0 : passStringToWasm0(trusted_roots, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len2 = WASM_VECTOR_LEN;
        wasm.verifyStatement(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr4 = r0;
        var len4 = r1;
        if (r3) {
            ptr4 = 0; len4 = 0;
            throw takeObject(r2);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred5_0, deferred5_1, 1);
    }
}

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
 * @param {Uint8Array} statement
 * @param {Uint8Array} key_set
 * @param {string} service_cert
 * @param {string | null} [trusted_roots]
 * @returns {string}
 */
export function verifyStatementWithServiceCert(statement, key_set, service_cert, trusted_roots) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(statement, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(key_set, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(service_cert, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(trusted_roots) ? 0 : passStringToWasm0(trusted_roots, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len3 = WASM_VECTOR_LEN;
        wasm.verifyStatementWithServiceCert(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr5 = r0;
        var len5 = r1;
        if (r3) {
            ptr5 = 0; len5 = 0;
            throw takeObject(r2);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred6_0, deferred6_1, 1);
    }
}

/**
 * The verification core's version, so a page can report what verified it.
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.version(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_now_d1fb6650485d7f3e: function() {
            const ret = Date.now();
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
    };
    return {
        __proto__: null,
        "./scitt_wasm_bg.js": import0,
    };
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('scitt_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
