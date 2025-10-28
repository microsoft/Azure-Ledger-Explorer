// Public API exports for the database layer
// Use this as the single import point for database functionality

export { CCFDatabase } from './ccf-database';
export type { DatabaseConfig } from './ccf-database';

// Re-export types that consumers might need
export type { Transaction, LedgerKeyValue, DatabaseTransaction } from '../types/ccf-types';
