/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useMutation } from '@tanstack/react-query';
import { scittVerificationService } from '../services/scitt-verification-service';
import type { ScittVerificationResult, StatementInspection } from '../types/scitt-types';

export interface VerifyInput {
  statement: ArrayBuffer;
  keySet: ArrayBuffer;
  issuer?: string;
}

/**
 * Verify a SCITT transparent statement.
 *
 * Modelled as a mutation rather than a query: the inputs are files a user just
 * dropped, there is nothing to cache them under, and re-running should be an
 * explicit act. Verification is also destructive to its inputs — the buffers
 * are transferred to the worker — so it must not be retried invisibly.
 */
export const useScittVerification = () =>
  useMutation<ScittVerificationResult, Error, VerifyInput>({
    mutationFn: ({ statement, keySet, issuer }) =>
      scittVerificationService.verify(statement, keySet, issuer),
    retry: false,
  });

/** Describe a statement without trust material. Establishes nothing. */
export const useScittInspection = () =>
  useMutation<StatementInspection, Error, ArrayBuffer>({
    mutationFn: (statement) => scittVerificationService.inspect(statement),
    retry: false,
  });
