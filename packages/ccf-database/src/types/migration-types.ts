/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Migration interface - each migration file must export this structure
 */
export interface Migration {
  version: number;
  name: string;
  statements: string[];
}
