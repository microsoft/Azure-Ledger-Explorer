/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  makeStyles,
  Text,
  tokens,
} from '@fluentui/react-components';
import {
  DocumentAdd24Regular,
  ShieldCheckmark24Regular,
  DataUsage24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    width: '100%',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: '180px',
    padding: '12px 16px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  number: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  icon: {
    color: tokens.colorBrandForeground1,
    fontSize: '18px',
  },
});

const STEPS: Array<{ title: string; subtitle: string; icon: React.ReactNode }> = [
  {
    title: 'Import',
    subtitle: 'Add Azure Ledger chunks',
    icon: <DocumentAdd24Regular />,
  },
  {
    title: 'Verify',
    subtitle: 'Check Merkle integrity',
    icon: <ShieldCheckmark24Regular />,
  },
  {
    title: 'Explore',
    subtitle: 'Browse transactions & KV',
    icon: <DataUsage24Regular />,
  },
];

/**
 * Compact 3-step "How it works" strip for the onboarding empty state.
 * Renders Import → Verify → Explore so a new user can quickly orient
 * themselves before deciding which import path to take.
 */
export const HowItWorks: React.FC = () => {
  const styles = useStyles();
  return (
    <div className={styles.container} role="list" aria-label="How it works">
      {STEPS.map((step, index) => (
        <div key={step.title} className={styles.step} role="listitem">
          <span className={styles.number} aria-hidden="true">{index + 1}</span>
          <div className={styles.body}>
            <Text className={styles.title}>
              <span className={styles.icon} aria-hidden="true">{step.icon}</span>
              {step.title}
            </Text>
            <Text className={styles.subtitle}>{step.subtitle}</Text>
          </div>
        </div>
      ))}
    </div>
  );
};
