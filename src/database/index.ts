/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Re-export everything from the @ccf/database package for backward compatibility
export * from '@ccf/database';

// App-specific types that aren't in the database package
export type { DatabaseTransaction } from '../types/ccf-types';
