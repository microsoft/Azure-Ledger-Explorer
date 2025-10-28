// Example integration of the verification component

import React from 'react';
import { VerificationComponent } from '../components/VerificationComponent';

export const VerificationPage: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>CCF Ledger Verification</h1>
      <p>
        This tool allows you to verify CCF ledger data stored in the database using a web worker.
        The verification process includes:
      </p>
      <ul>
        <li>Transaction digest validation</li>
        <li>Merkle tree verification against signature transactions</li>
        <li>Progress reporting every 50 transactions</li>
        <li>Simple resume capability using browser storage</li>
        <li>Background processing with pause/resume controls</li>
      </ul>
      
      <VerificationComponent />
    </div>
  );
};

export default VerificationPage;
