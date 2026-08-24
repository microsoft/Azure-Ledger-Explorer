/* tslint:disable */
/* eslint-disable */

/**
 * Convenience for callers that only need the identity of the bytes, such as a
 * ledger explorer matching a statement against a transaction it already holds.
 */
export function claimDigest(statement: Uint8Array): string;

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
 * Describe a statement without trust material.
 *
 * Answers "what is in this file?" and deliberately not "should I trust it?".
 * Nothing here is evidence: with no key set, no receipt signature can be
 * checked, so every verification field is absent rather than false.
 */
export function inspectStatement(statement: Uint8Array): string;

/**
 * Verify a transparent statement against a COSE_KeySet.
 *
 * `issuer`, when supplied, scopes the key set to one transparency service.
 * Leaving it `None` is weaker evidence and the result says so, because an
 * unscoped key set will happily verify a receipt from the wrong ledger.
 *
 * Returns a JSON document. Errors are returned as JS exceptions only when
 * nothing could be established at all; a statement that parses but fails
 * verification is a *result*, not an error, and callers must render it.
 */
export function verifyStatement(statement: Uint8Array, key_set: Uint8Array, issuer?: string | null): string;

/**
 * The verification core's version, so a page can report what verified it.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly claimDigest: (a: number, b: number, c: number) => void;
    readonly describeCertificate: (a: number, b: number, c: number, d: number) => void;
    readonly describeReceipt: (a: number, b: number, c: number) => void;
    readonly inspectStatement: (a: number, b: number, c: number) => void;
    readonly verifyStatement: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly version: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
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
