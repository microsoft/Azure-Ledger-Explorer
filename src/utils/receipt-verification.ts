/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import * as jsrsasign from 'jsrsasign';
import { Buffer } from 'buffer';

// Define our own receipt interface to avoid Azure package dependency issues
export interface ReceiptContentsOutput {
  cert?: string;
  leafComponents?: {
    writeSetDigest?: string;
    commitEvidence?: string;
    claimsDigest?: string;
  };
  proof?: Array<{
    left?: string;
    right?: string;
  }>;
  signature?: string;
  serviceEndorsements?: string[];
}

export interface VerificationResult {
  isCompleted: boolean;
  isValid: boolean;
  txDigest: string;
  merklePath: string[];
}

const buf2hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString('hex');

const str2ab = (str: string) => new TextEncoder().encode(str);

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

const appendBuffer = (buffer1: ArrayBuffer | Uint8Array, buffer2: ArrayBuffer | Uint8Array) => {
  const uint1 = buffer1 instanceof ArrayBuffer ? new Uint8Array(buffer1) : buffer1;
  const uint2 = buffer2 instanceof ArrayBuffer ? new Uint8Array(buffer2) : buffer2;
  const result = new Uint8Array(uint1.length + uint2.length);
  result.set(uint1, 0);
  result.set(uint2, uint1.length);
  return result;
};

const base64ToHex = (str: string) => Buffer.from(str, 'base64').toString('hex');

const getTxDigest = async (rx: ReceiptContentsOutput) => {
  const leaf_components = rx.leafComponents;
  const write_set_digest = hexToBytes(leaf_components?.writeSetDigest ?? '');

  const commit_evidence_digest = await crypto.subtle.digest('SHA-256', str2ab(leaf_components?.commitEvidence ?? ''));
  const claims_digest = hexToBytes(leaf_components?.claimsDigest ?? '');

  const combined = appendBuffer(
    write_set_digest, 
    appendBuffer(new Uint8Array(commit_evidence_digest), claims_digest)
  );
  
  return await crypto.subtle.digest('SHA-256', combined);
};

const getMerklePath = async (prev_hash: ArrayBuffer, rx?: ReceiptContentsOutput) => {
  if (!rx || !rx.proof) {
    return [];
  }

  const path = [];
  let currentHash = prev_hash;
  
  for (const v of rx.proof) {
    if (v.left !== undefined) {
      const combined = appendBuffer(hexToBytes(v.left), new Uint8Array(currentHash));
      currentHash = await crypto.subtle.digest('SHA-256', combined);
    } else if (v.right !== undefined) {
      const combined = appendBuffer(new Uint8Array(currentHash), hexToBytes(v.right));
      currentHash = await crypto.subtle.digest('SHA-256', combined);
    }
    path.push(buf2hex(currentHash));
  }
  return path;
};

/**
 * Takes a PEM encoded certificate chain array and verifies it
 * Taken from this snippet listed here: https://github.com/trasherdk/jsrsasign/issues/3
 * @param  {String[]} certificates - PEM certificate chain
 * @return {Boolean}               - Returns if certificate chain can be validated
 */
const verifyCertificateChain = (certificates: string[]): boolean => {
  if (certificates.length < 2) {
    return false;
  }

  for (let i = 0; i < certificates.length - 1; i++) {
    const certificate = new jsrsasign.X509();
    certificate.readCertPEM(certificates[i]);

    const parentCert = certificates[i + 1];

    const certStruct = jsrsasign.ASN1HEX.getTLVbyList(certificate.hex, 0, [0]);
    if (!certStruct) {
      return false;
    }
    const algorithm = certificate.getSignatureAlgorithmField();
    const signatureHex = certificate.getSignatureValueHex();

    const Signature = new jsrsasign.KJUR.crypto.Signature({ alg: algorithm });
    Signature.init(parentCert);
    Signature.updateHex(certStruct);
    if (!Signature.verify(signatureHex)) {
      return false;
    }
  }

  return true;
};

const verifyReceiptInternal = async (
  networkCertificate?: string,
  receipt?: ReceiptContentsOutput,
): Promise<VerificationResult> => {
  if (!receipt || !networkCertificate || !receipt.cert || !receipt.signature) {
    return { isCompleted: false, isValid: false, txDigest: '', merklePath: [] };
  }

  const txDigest = await getTxDigest(receipt);
  const merklePath = await getMerklePath(txDigest, receipt);
  const calculatedRootHashHex = merklePath[merklePath.length - 1];

  const publicKey = jsrsasign.KEYUTIL.getKey(receipt.cert);
  const isValid = publicKey.verifyWithMessageHash(calculatedRootHashHex, base64ToHex(receipt.signature));

  const certs = [receipt.cert, ...(receipt?.serviceEndorsements || []), networkCertificate];
  const isValidCertChain = verifyCertificateChain(certs);

  return {
    isCompleted: true,
    isValid: isValid && isValidCertChain,
    txDigest: buf2hex(txDigest),
    merklePath,
  };
};

export const verifyReceipt = async (networkCertificate?: string, receipt?: ReceiptContentsOutput) => {
  return await verifyReceiptInternal(networkCertificate, receipt);
};
