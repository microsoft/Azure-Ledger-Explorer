/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { decode, diagnose } from 'cbor2';
import { Buffer } from "buffer";

/** CBOR values can be primitives, arrays, maps, or binary data */
type CborValue = unknown;
/** CBOR map keys are typically strings or numbers */
type CborKey = string | number;

/**
 * Decodes a COSE Sign1 structure (CBOR array with tag 18) into a human-readable JSON string.
 * 
 * @param cbor - The CBOR-encoded data as a Uint8Array
 * @returns A formatted JSON string representation of the COSE structure
 * 
 * @example
 * ```typescript
 * const coseData = new Uint8Array([...]);
 * const readable = cborArrayToText(coseData);
 * console.log(readable);
 * ```
 */
export function cborArrayToText(cbor: Uint8Array): string {
    const decoded = decode(cbor) as { tag?: number; contents?: unknown[] } | unknown[];
    
    const output: Record<string, unknown> = {};
    let parts: unknown[] = [];
    if (typeof decoded === 'object' && decoded !== null && 'tag' in decoded && decoded.tag === 18) {
        parts = decoded.contents ?? [];
    } else if (Array.isArray(decoded) && decoded.length === 4) {
        parts = decoded;
    } else {
        const diagnosed = prettyPrintDecodedCbor(decoded as Uint8Array);
        return typeof diagnosed === 'string' ? diagnosed : JSON.stringify(diagnosed, null, 2);
    }

    if (parts.length === 4) {
        output['protected'] = ArrayBuffer.isView(parts[0]) && parts[0] instanceof Uint8Array ? prettyPrintCborMap(null, decode(parts[0], {preferMap:true}) as Map<CborKey, CborValue>) : parts[0];
        output['unprotected'] = ArrayBuffer.isView(parts[1]) && parts[1] instanceof Uint8Array ? prettyPrintCborMap(null, decode(parts[1], {preferMap:true}) as Map<CborKey, CborValue>) : parts[1];
        output['payload'] = prettyPrintCosePayload(parts[2] as Uint8Array);
        output['signature'] = uint8ArrayToHexString(parts[3] as Uint8Array);
    }

    return JSON.stringify(output, null, 2);
}

// https://www.iana.org/assignments/cose/cose.xhtml
const coseHeaderParameters: Record<string, string> = {
  "0": "Reserved",
  "1": "alg",
  "2": "crit",
  "3": "content type",
  "4": "kid",
  "5": "IV",
  "6": "Partial IV",
  "7": "counter signature",
  "8": "Unassigned",
  "9": "CounterSignature0",
  "10": "kid context",
  "11": "Countersignature version 2",
  "12": "Countersignature0 version 2",
  "13": "kcwt",
  "14": "kccs",
  "15": "CWT Claims",
  "16": "typ (type)",
  "22": "c5t",
  "23": "c5u",
  "24": "c5b",
  "25": "c5c",
  "32": "x5bag",
  "33": "x5chain",
  "34": "x5t",
  "35": "x5u",
  "256": "CUPHNonce",
  "257": "CUPHOwnerPubKey",
  "258": "payload-hash-alg",
  "259": "preimage content type",
  "260": "payload-location",
  "261": "x5ts",
  "262": "srCms",
  "263": "sigPl",
  "264": "srAts",
  "265": "adoTst",
  "266": "sigPId",
  "267": "sigD",
  "268": "uHeaders",
  "269": "3161-ttc",
  "270": "3161-ctt",
  "394": "receipts",
  "395": "vds",
  "396": "vdp"
};

// https://www.iana.org/assignments/cose/cose.xhtml
const coseAlgorithms: Record<string, string> = {
  "-65535": "RS1",
  "-65534": "A128CTR",
  "-65533": "A192CTR",
  "-65532": "A256CTR",
  "-65531": "A128CBC",
  "-65530": "A192CBC",
  "-65529": "A256CBC",
  "-268": "ESB512",
  "-267": "ESB384",
  "-266": "ESB320",
  "-265": "ESB256",
  "-264": "KT256",
  "-263": "KT128",
  "-262": "TurboSHAKE256",
  "-261": "TurboSHAKE128",
  "-260": "WalnutDSA",
  "-259": "RS512",
  "-258": "RS384",
  "-257": "RS256",
  "-53": "Ed448",
  "-52": "ESP512",
  "-51": "ESP384",
  "-50": "ML-DSA-87",
  "-49": "ML-DSA-65",
  "-48": "ML-DSA-44",
  "-47": "ES256K",
  "-46": "HSS-LMS",
  "-45": "SHAKE256",
  "-44": "SHA-512",
  "-43": "SHA-384",
  "-42": "RSAES-OAEP w/ SHA-512",
  "-41": "RSAES-OAEP w/ SHA-256",
  "-40": "RSAES-OAEP w/ RFC 8017 default parameters",
  "-39": "PS512",
  "-38": "PS384",
  "-37": "PS256",
  "-36": "ES512",
  "-35": "ES384",
  "-34": "ECDH-SS + A256KW",
  "-33": "ECDH-SS + A192KW",
  "-32": "ECDH-SS + A128KW",
  "-31": "ECDH-ES + A256KW",
  "-30": "ECDH-ES + A192KW",
  "-29": "ECDH-ES + A128KW",
  "-28": "ECDH-SS + HKDF-512",
  "-27": "ECDH-SS + HKDF-256",
  "-26": "ECDH-ES + HKDF-512",
  "-25": "ECDH-ES + HKDF-256",
  "-19": "Ed25519",
  "-18": "SHAKE128",
  "-17": "SHA-512/256",
  "-16": "SHA-256",
  "-15": "SHA-256/64",
  "-14": "SHA-1",
  "-13": "direct+HKDF-AES-256",
  "-12": "direct+HKDF-AES-128",
  "-11": "direct+HKDF-SHA-512",
  "-10": "direct+HKDF-SHA-256",
  "-9": "ESP256",
  "-8": "EdDSA",
  "-7": "ES256",
  "-6": "direct",
  "-5": "A256KW",
  "-4": "A192KW",
  "-3": "A128KW",
  "1": "A128GCM",
  "2": "A192GCM",
  "3": "A256GCM",
  "4": "HMAC 256/64",
  "5": "HMAC 256/256",
  "6": "HMAC 384/384",
  "7": "HMAC 512/512",
  "10": "AES-CCM-16-64-128",
  "11": "AES-CCM-16-64-256",
  "12": "AES-CCM-64-64-128",
  "13": "AES-CCM-64-64-256",
  "14": "AES-MAC 128/64",
  "15": "AES-MAC 256/64",
  "24": "ChaCha20/Poly1305",
  "25": "AES-MAC 128/128",
  "26": "AES-MAC 256/128",
  "30": "AES-CCM-16-128-128",
  "31": "AES-CCM-16-128-256",
  "32": "AES-CCM-64-128-128",
  "33": "AES-CCM-64-128-256",
  "34": "IV-GENERATION"
};

// https://www.iana.org/assignments/cwt/cwt.xhtml
const cwtClaimKeys: Record<string, string> = {
  "-261": "globalplatform_component",
  "-260": "hcert",
  "-259": "EUPHNonce",
  "-258": "EATMAROEPrefix",
  "-257": "EAT-FDO",
  "1": "iss",
  "2": "sub",
  "3": "aud",
  "4": "exp",
  "5": "nbf",
  "6": "iat",
  "7": "cti",
  "8": "cnf",
  "9": "scope",
  "10": "Nonce",
  "38": "ace_profile",
  "39": "cnonce",
  "40": "exi",
  "169": "identity-data",
  "256": "UEID",
  "257": "SUEIDs",
  "258": "Hardware OEM ID",
  "259": "Hardware Model",
  "260": "Hardware Version",
  "261": "Uptime",
  "262": "OEM Authorized Boot",
  "263": "Debug Status",
  "264": "Location",
  "265": "EAT Profile",
  "266": "Submodules Section",
  "267": "Boot Count",
  "268": "Boot Seed",
  "269": "DLOAs",
  "270": "Software Name",
  "271": "Software Version",
  "272": "Software Manifests",
  "273": "Measurements",
  "274": "Software Measurement Results",
  "275": "Intended Use",
  "282": "geohash",
  "300": "wmver",
  "301": "wmvnd",
  "302": "wmpatlen",
  "303": "wmsegduration",
  "304": "wmpattern",
  "305": "wmid",
  "306": "wmopid",
  "307": "wmkeyver",
  "308": "catreplay",
  "309": "catpor",
  "310": "catv",
  "311": "catnip",
  "312": "catu",
  "313": "catm",
  "314": "catalpn",
  "315": "cath",
  "316": "catgeoiso3166",
  "317": "catgeocoord",
  "318": "catgeoalt",
  "319": "cattpk",
  "320": "catifdata",
  "321": "catdpop",
  "322": "catif",
  "323": "catr",
  "2394": "psa-client-id",
  "2395": "psa-security-lifecycle",
  "2396": "psa-implementation-id",
  "2398": "psa-certification-reference",
  "2399": "psa-software-components",
  "2400": "psa-verification-service-indicator"
};

// https://www.ietf.org/rfc/rfc9679.html
const coseKeyKeys: Record<string, string> = {
    "1": "kty",
};

function prettyPrintArbitraryCborVal(value: CborValue, idxOrKey?: CborKey): CborValue {
    if (value instanceof Uint8Array) {
        return uint8ArrayToHexString(value);
    } else if (value instanceof Map) {
        return prettyPrintCborMap(idxOrKey ?? null, value as Map<CborKey, CborValue>);
    } else if (Array.isArray(value)) {
        return value.map((item, idx) => prettyPrintArbitraryCborVal(item, idxOrKey != null ? `${idxOrKey}.${idx}` : idx));
    } else {
        return value;
    }
}

function prettyCborKeyValue(parentKey: CborKey | null, key: CborKey, value: CborValue): [CborKey, CborValue] {
    if (!parentKey) {
        const keyStr = key.toString();
        const prettyKey = coseHeaderParameters[keyStr] || key;
        if (keyStr === '1' || keyStr === '258') { // algorithm
            const valueStr = String(value);
            const prettyValue = coseAlgorithms[valueStr] || value;
            return [prettyKey, prettyValue];
        }
        if (keyStr === '4') { // kid
            return [prettyKey, uint8ArrayToHexString(value as Uint8Array)];
        }

        if (keyStr === '15' || value instanceof Map) {
            // process nested maps
            return [prettyKey, prettyPrintCborMap(key, value as Map<CborKey, CborValue>)];
        }

        if (keyStr === '33') { // X5chain
            return [prettyKey, (value as Uint8Array[]).map(uint8ArrayToB64String)];
        }

        if (keyStr === '34') { // X5 thumbprint
            const thumbprint = value as [number, Uint8Array];
            return [prettyKey, coseAlgorithms[thumbprint[0]] + ':' + uint8ArrayToHexString(thumbprint[1])];
        }

        if (keyStr === '394') { // Attached receipts
            return [prettyKey, (value as Uint8Array[]).map(prettyPrintDecodedCbor)];
        }

        return [prettyKey, prettyPrintArbitraryCborVal(value)];
    } else if (parentKey !== undefined && parentKey !== null) {
        if (parentKey.toString() === '15') { // If parent was CWT Claims
            const keyStr = key.toString();
            const prettyKey = cwtClaimKeys[keyStr] || key;
            return [prettyKey, prettyPrintArbitraryCborVal(value)];
        }
        if (parentKey === 'msft-css-dev' || parentKey === 'attestedsvc') {
            // reserved for future pretty-printing rules
        }
        if (parentKey === 'cose_key') {
            const keyStr = key.toString();
            const prettyKey = coseKeyKeys[keyStr] || key;
            return [prettyKey, prettyPrintArbitraryCborVal(value)];
        }
        return [key, prettyPrintArbitraryCborVal(value, key)];
    }

    // Fallback – should not normally be hit
    return [key, value];
}

function prettyPrintCborMap(parentKey: CborKey | null, headers: Map<CborKey, CborValue>): Record<string, CborValue> {
    const output: Record<string, CborValue> = {};
    headers.forEach((value, key) => {
        const [newKey, newValue] = prettyCborKeyValue(parentKey, key, value);
        output[String(newKey)] = newValue;
    });
    return output;
}

function prettyPrintDecodedCbor(input: Uint8Array): object | string {
    return diagnose(input, { pretty: true });
}

/**
 * Converts a Uint8Array to a hexadecimal string
 */
export function uint8ArrayToHexString(uint8Array: Uint8Array): string {
    return Array.from(uint8Array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Converts a Uint8Array to a base64-encoded string
 */
export function uint8ArrayToB64String(uint8Array: Uint8Array): string {
    return Buffer.from(uint8Array).toString('base64');
}

function prettyPrintCosePayload(input: Uint8Array): CborValue {
    // test if Uint8Array is json
    const text = new TextDecoder().decode(input);
    try {
        const json = JSON.parse(text) as unknown;
        return json;
    } catch {
        // not json
    }

    // test if text
    if (/^[\x20-\x7E]*$/.test(text)) {
        return text;
    }

    // test if CBOR
    try {
        const decoded = decode(input);
        return prettyPrintArbitraryCborVal(decoded);
    } catch {
        // not cbor
    }

    // fallback
    return uint8ArrayToB64String(input);
}
