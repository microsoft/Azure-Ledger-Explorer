/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { SCITT_TABLES, CCF_GOV_TABLES } from '@microsoft/ccf-ledger-parser';

export const DecodeCborTables = [
  SCITT_TABLES.ENTRY,
  CCF_GOV_TABLES.COSE_HISTORY,
] as const;

export type DecodeCborTableName = (typeof DecodeCborTables)[number];

export function shouldDecodeCborValue(mapName: string | null | undefined): boolean {
  if (!mapName) return false;
  return (DecodeCborTables as readonly string[]).includes(mapName);
}
