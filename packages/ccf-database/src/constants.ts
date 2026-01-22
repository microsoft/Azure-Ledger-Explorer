/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Default database filename used for SQLite storage.
 * This is used for both OPFS and transient storage modes.
 */
export const DATABASE_FILENAME = 'ccf-ledger.sqlite3';

/**
 * Full path to the database file (with leading slash for OPFS).
 */
export const DATABASE_PATH = `/${DATABASE_FILENAME}`;
