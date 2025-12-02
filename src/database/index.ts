/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export { CCFDatabase } from './ccf-database';
export type { DatabaseConfig } from './ccf-database';

// Re-export types that consumers might need
export type { Transaction, LedgerKeyValue } from '@ccf/ledger-parser';
export type { DatabaseTransaction } from '../types/ccf-types';
