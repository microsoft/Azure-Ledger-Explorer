/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useMemo } from 'react';
import {
  makeStyles,
  mergeClasses,
  Card,
  CardFooter,
  Button,
  Text,
  Caption1,
  tokens,
} from '@fluentui/react-components';
import {
  Folder24Filled,
  CloudArrowUp24Filled,
  ShieldCheckmark24Filled,
  ChevronRight20Regular,
} from '@fluentui/react-icons';
import { trackEvent, TelemetryEvents } from '../../services/telemetry';
import { HowItWorks } from './HowItWorks';
import { WhatIsLedgerPopover } from './WhatIsLedgerPopover';
import { LoadSampleButton } from './LoadSampleButton';
import { isMstEnabled } from '../../utils/feature-flags';
import ccfLogo from '../../assets/ccf.svg';

export type OnboardingPath = 'local' | 'azure' | 'mst';

export interface WelcomeHeroProps {
  /** Invoked when the user picks an import path (also fires telemetry). */
  onPathClick: (path: OnboardingPath) => void;
  /** Invoked when the bundled sample ledger fails to load. */
  onSampleError?: (message: string) => void;
  /**
   * If true, all interactive controls in the hero are disabled. The parent
   * uses this to gate the hero on app-wide import busyness so users can't
   * start two competing imports.
   */
  disabled?: boolean;
}

interface PathCard {
  path: OnboardingPath;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
}

const PATH_CARDS: PathCard[] = [
  {
    path: 'local',
    title: 'Local files',
    description: 'Drag & drop Azure Ledger chunks (`.committed` files) you already have on disk. Everything is parsed and indexed locally.',
    icon: <Folder24Filled />,
    cta: 'Upload files',
  },
  {
    path: 'azure',
    title: 'Azure Confidential Ledger',
    description: 'Pull a backup directly from an Azure Storage container using a SAS URL. No data leaves your browser.',
    icon: <CloudArrowUp24Filled />,
    cta: 'Connect with SAS',
  },
  {
    path: 'mst',
    title: 'Signing Transparency',
    description: 'Fetch chunks from a known Microsoft Signing Transparency domain to audit a software-supply-chain log.',
    icon: <ShieldCheckmark24Filled />,
    cta: 'Fetch from MST',
  },
];

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflowY: 'auto',
    padding: '32px 24px',
    gap: '24px',
    width: '100%',
    boxSizing: 'border-box',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    textAlign: 'center',
    maxWidth: '720px',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px',
  },
  logo: {
    height: '40px',
    width: 'auto',
  },
  title: {
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
  },
  subtitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
  },
  cardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
    maxWidth: '960px',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
      maxWidth: '420px',
    },
  },
  card: {
    cursor: 'pointer',
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    ':hover': {
      transform: 'translateY(-3px)',
      boxShadow: tokens.shadow16,
      border: `1px solid ${tokens.colorBrandStroke2}`,
    },
    ':focus-within': {
      border: `1px solid ${tokens.colorBrandStroke1}`,
    },
  },
  // Strip the interactive affordances when the parent gates the hero on
  // app-wide busyness. Without this, the cards still advertised clickability
  // (pointer cursor, hover lift, brand-stroke border) during an active import
  // even though clicks were no-ops.
  cardDisabled: {
    cursor: 'default',
    ':hover': {
      transform: 'none',
      boxShadow: 'none',
      border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    ':focus-within': {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '20px 20px 8px 20px',
    gap: '8px',
  },
  cardIcon: {
    fontSize: '32px',
    color: tokens.colorBrandForeground1,
  },
  cardTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  cardDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
  },
  cardFooter: {
    padding: '8px 16px 16px 16px',
  },
  howSection: {
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  howSectionLabel: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  sampleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sampleHint: {
    color: tokens.colorNeutralForeground3,
  },
});

/**
 * Empty-state welcome hero shown on `/files` when the database has no data.
 *
 * Provides:
 *  - app value prop and a "What is an Azure Ledger?" learn-more popover,
 *  - three import-path cards that deep-link into AddFilesWizard,
 *  - a compact "How it works" 3-step strip,
 *  - a one-click "Load sample ledger" CTA.
 */
export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onPathClick, onSampleError, disabled }) => {
  const styles = useStyles();

  // MST is still a preview service, so the Signing Transparency card only
  // shows when the user has explicitly opted in via `?mst=true`. We compute
  // this once per mount; the flag itself is cached at module-init.
  const visibleCards = useMemo(
    () => PATH_CARDS.filter(c => c.path !== 'mst' || isMstEnabled()),
    []
  );

  const handleCardClick = (path: OnboardingPath) => {
    if (disabled) return;
    trackEvent(TelemetryEvents.ONBOARDING_PATH_CLICKED, { path });
    onPathClick(path);
  };

  return (
    <div className={styles.root}>
      {/* Hero header */}
      <div className={styles.hero}>
        <div className={styles.brandRow}>
          <img src={ccfLogo} alt="" className={styles.logo} aria-hidden="true" />
          <h1 className={styles.title}>Welcome to Ledger Explorer</h1>
        </div>
        <div className={styles.subtitleRow}>
          <Text className={styles.subtitle}>
            Explore Confidential Ledger data — entirely in your browser. No data leaves your machine.
          </Text>
          <WhatIsLedgerPopover />
        </div>
      </div>

      {/* Import path cards. The cards row is a labeled list; each card hosts a
          single explicit button as its actionable control so we don't need to
          make the card div itself focusable (which would risk keyboard event
          double-firing when activating the inner button). */}
      <div className={styles.cardsRow} role="list" aria-label="Choose how to import a ledger">
        {visibleCards.map(card => (
          <Card
            key={card.path}
            className={mergeClasses(styles.card, disabled && styles.cardDisabled)}
            role="listitem"
            aria-label={card.title}
            aria-disabled={disabled || undefined}
            onClick={() => handleCardClick(card.path)}
          >
            <div className={styles.cardBody}>
              <div className={styles.cardIcon} aria-hidden="true">{card.icon}</div>
              <Text className={styles.cardTitle}>{card.title}</Text>
              <Text className={styles.cardDescription}>{card.description}</Text>
            </div>
            <CardFooter className={styles.cardFooter}>
              <Button
                appearance="primary"
                icon={<ChevronRight20Regular />}
                iconPosition="after"
                disabled={disabled}
                onClick={(e) => {
                  // The outer Card also has an onClick (mouse-friendly affordance);
                  // stop propagation so we don't fire the handler twice in the same
                  // mouse interaction.
                  e.stopPropagation();
                  handleCardClick(card.path);
                }}
              >
                {card.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* How it works */}
      <div className={styles.howSection}>
        <Caption1 className={styles.howSectionLabel}>How it works</Caption1>
        <HowItWorks />
      </div>

      {/* Sample shortcut */}
      <div className={styles.sampleRow}>
        <Caption1 className={styles.sampleHint}>Just want to try it?</Caption1>
        <LoadSampleButton onError={onSampleError} disabled={disabled} />
      </div>
    </div>
  );
};
