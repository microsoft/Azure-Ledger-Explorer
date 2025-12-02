/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom';

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
  localStorage.clear();
  cleanup();
});