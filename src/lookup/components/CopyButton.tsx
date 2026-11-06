/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useEffect, useState } from 'react';
import { Button, Tooltip } from '@fluentui/react-components';
import { Checkmark16Regular, Copy16Regular, Link20Regular } from '@fluentui/react-icons';

interface CopyButtonProps {
  /** Text to copy; read when clicked, so it may change after render. */
  value: string | (() => string);
  /** What is copied, for the tooltip and screen readers. */
  what: string;
  /** Show a labelled "Copy link" button instead of a bare icon. */
  link?: boolean;
}

/** Copies a value to the clipboard and briefly confirms it. */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, what, link }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    const text = typeof value === 'function' ? value() : value;
    void navigator.clipboard?.writeText(text).then(() => setCopied(true));
  };

  const label = copied ? 'Copied' : `Copy ${what}`;
  const icon = copied ? <Checkmark16Regular /> : link ? <Link20Regular /> : <Copy16Regular />;

  if (link) {
    return (
      <Button size="small" icon={icon} onClick={copy} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    );
  }
  return (
    <Tooltip content={label} relationship="label" withArrow>
      <Button size="small" appearance="subtle" icon={icon} onClick={copy} />
    </Tooltip>
  );
};
