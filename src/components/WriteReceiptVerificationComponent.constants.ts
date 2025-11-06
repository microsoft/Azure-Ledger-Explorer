/**
 * Constants for WriteReceiptVerificationComponent
 * Contains multi-line text content and error messages
 */

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_JSON_FILE: 'Please select a JSON file for the receipt',
  FAILED_READ_RECEIPT: 'Failed to read receipt file',
  FAILED_READ_CERTIFICATE: 'Failed to read certificate file',
} as const;

// Multi-line descriptive text
export const CONTENT_TEXT = {
  // Scope banner description
  ACL_VERIFICATION_DESCRIPTION: 
    'This page verifies Azure Confidential Ledger (ACL) write transaction receipts using Merkle tree proofs.',

  // Common issue descriptions  
  MERKLE_ROOT_MISMATCH: 
    'The calculated root does not match the receipt root. This usually indicates the receipt was generated for a different ledger or has been modified.',
  
  CERTIFICATE_MISMATCH: 
    "Ensure you're using the correct network certificate from the same Azure Confidential Ledger instance that generated the receipt.",
  
  INVALID_JSON_FORMAT: 
    'Verify the receipt JSON is complete, properly formatted, and contains all required fields (cert, leafComponents, proof, signature).',
  
  WRONG_LEDGER_INSTANCE: 
    "Confirm the receipt was generated for the ledger you're verifying against.",

  // Troubleshooting step descriptions
  TROUBLESHOOTING_REDOWNLOAD: 
    'Obtain fresh copies of both the receipt JSON and network certificate from your Azure Confidential Ledger instance.',
  
  TROUBLESHOOTING_VERIFY_INTEGRITY: 
    'Check that files were not corrupted during download or transfer. Ensure no extra whitespace or encoding issues.',
  
  TROUBLESHOOTING_CHECK_TRANSACTION: 
    "Verify you're using the correct transaction ID when retrieving the receipt from the ledger API.",
  
  TROUBLESHOOTING_REVIEW_ACCESS: 
    'Ensure you have proper permissions to access the ledger and that the ledger is in a healthy state.',
} as const;
