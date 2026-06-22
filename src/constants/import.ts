/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Total selected-chunk size (in bytes) at which the UI warns that the import
 * may destabilise the app. Applies to both MST downloads and local uploads.
 *
 * 500 MB — change this value to adjust the warning threshold.
 */
export const IMPORT_SIZE_WARNING_BYTES = 500 * 1024 ** 2;
