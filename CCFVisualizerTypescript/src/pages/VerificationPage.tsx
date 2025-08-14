// Example integration of the verification component

import React from 'react';
import { VerificationComponent } from '../components/VerificationComponent';

export const VerificationPage: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>CCF Ledger Verification</h1>
      <p>
        This tool allows you to verify CCF ledger files in the background using a web worker.
        The verification process includes:
      </p>
      <ul>
        <li>Transaction digest validation</li>
        <li>Automatic checkpointing every 100 transactions</li>
        <li>Progress reporting every 50 transactions</li>
        <li>Failure detection and reporting</li>
        <li>Resume protection (cannot resume after failure)</li>
      </ul>
      
      <VerificationComponent />
    </div>
  );
};

export default VerificationPage;
