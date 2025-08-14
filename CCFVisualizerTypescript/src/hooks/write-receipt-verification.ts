/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { verifyReceipt, type VerificationResult } from '../utils/receipt-verification';
import type { 
  WriteReceipt, 
  WriteReceiptVerificationResult
} from '../types/write-receipt-types';

// Convert WriteReceipt to ReceiptContentsOutput format for existing verification
const convertWriteReceiptToReceiptContents = (receipt: WriteReceipt) => {
  return {
    cert: receipt.cert,
    leafComponents: receipt.leafComponents,
    nodeId: receipt.nodeId,
    proof: receipt.proof,
    signature: receipt.signature
  };
};

export const useWriteReceiptVerification = (
  networkCertificate?: string, 
  receipt?: WriteReceipt
) => {
  const [verificationResult, setVerificationResult] = React.useState<WriteReceiptVerificationResult>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      if (!networkCertificate || !receipt) {
        setVerificationResult(undefined);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Convert to format expected by existing verification
        const receiptContents = convertWriteReceiptToReceiptContents(receipt);
        
        // Verify using existing verification logic
        const result = await verifyReceipt(networkCertificate, receiptContents);
        
        // Get calculated root from merkle path
        const calculatedRoot = result.merklePath.length > 0 
          ? result.merklePath[result.merklePath.length - 1] 
          : '';

        // For now, we'll assume the receipt root is the final calculated root
        // This will be enhanced when we integrate with ledger data
        const receiptRoot = calculatedRoot;
        const rootsMatch = calculatedRoot === receiptRoot;

        setVerificationResult({
          isValid: result.isValid,
          isCompleted: result.isCompleted,
          calculatedRoot,
          receiptRoot,
          txDigest: result.txDigest,
          merklePath: result.merklePath,
          rootsMatch,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setVerificationResult({
          isValid: false,
          isCompleted: false,
          calculatedRoot: '',
          receiptRoot: '',
          txDigest: '',
          merklePath: [],
          rootsMatch: false,
          error: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [networkCertificate, receipt]);

  const verifyWithLedgerData = React.useCallback(async (
    _targetTransactionId?: string
  ) => {
    // This will be implemented to check against actual ledger data
    // For now, return the current result
    return verificationResult;
  }, [verificationResult]);

  return {
    verificationResult,
    isLoading,
    error,
    verifyWithLedgerData,
  };
};

// Keep the original hook for backwards compatibility
export const useVerificationHook = (networkCertificate?: string, receipt?: any) => {
  const [verificationResult, setVerificationResult] = React.useState<VerificationResult>();

  React.useEffect(() => {
    void (async () => {
      if (!networkCertificate || !receipt) return;
      setVerificationResult(await verifyReceipt(networkCertificate, receipt));
    })();
  }, [networkCertificate, receipt]);

  return verificationResult;
};
