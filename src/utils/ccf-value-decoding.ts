/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * CCF stores many text-valued KV entries (notably `public:ccf.gov.constitution`
 * and JS modules under `public:ccf.gov.modules`) as a JSON-encoded string: the
 * on-ledger bytes are the UTF-8 of a JSON string literal such as
 * `"const r = /\\s+/;\n..."`.
 *
 * Decoding that requires real JSON unescaping. Naive manual handling (e.g.
 * stripping the outer quotes and replacing only `\n`/`\t`) leaves `\\` and
 * `\"` intact, which corrupts source code — a regex `/\s+/` would render as
 * `/\\s+/` and break syntax highlighting in the viewer — and can also wrongly
 * collapse `\\n` (escaped backslash followed by `n`) into a real newline.
 *
 * This helper unwraps a JSON-string envelope when present and returns the
 * underlying text. Inputs that aren't quoted JSON strings are returned as-is,
 * so it is safe to apply to arbitrary decoded text.
 */
export function unwrapJsonEncodedString(text: string): string {
  if (text.length < 2 || !text.startsWith('"') || !text.endsWith('"')) {
    return text;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'string' ? parsed : text;
  } catch {
    return text;
  }
}
