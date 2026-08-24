const REQUIRED_HEADER = `/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */`;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require license header in linted files",
    },
    schema: [],
    messages: {
      missingHeader: "Missing required license header.",
    },
  },

  create(context) {
    return {
      Program(node) {
        // Normalize CRLF so the rule checks the header text, not the checkout's
        // line endings. Without this every file fails on a Windows working tree.
        const source = context.sourceCode.getText().replace(/\r\n/g, "\n");

        if (!source.startsWith(REQUIRED_HEADER)) {
          context.report({
            node,
            messageId: "missingHeader",
          });
        }
      },
    };
  },
};