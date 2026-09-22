/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useEffect, useRef } from 'react';
import {
  Body1,
  makeStyles,
  Text,
  tokens,
} from '@fluentui/react-components';
import { GovernanceTimeline } from '../components/governance';
import { useGovernanceEvents } from '../hooks/use-ccf-data';
import {
  trackEvent,
  TelemetryEvents,
} from '../services/telemetry/telemetry-service';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
  },
  header: {
    padding: '16px 24px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  content: {
    flex: 1,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1400px',
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 auto',
    '@media (max-width: 768px)': {
      padding: tokens.spacingVerticalL,
    },
  },
  description: {
    marginBottom: tokens.spacingVerticalL,
    display: 'block',
    marginTop: tokens.spacingVerticalS,
  },
});

export const GovernancePage: React.FC = () => {
  const styles = useStyles();
  const { data: events, isLoading, error } = useGovernanceEvents();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!events || trackedRef.current) return;
    trackedRef.current = true;
    const present = new Set(events.map((e) => e.category));
    trackEvent(TelemetryEvents.GOVERNANCE_PAGE_OPENED, {
      eventCount: events.length,
      categoriesPresent: Array.from(present).join(','),
    });
  }, [events]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text as="h1" size={700} weight="semibold">
          Governance
        </Text>
        <Body1 className={styles.description}>
          Browse member, node, service, proposal, and constitution changes from
          the imported ledger files. Click a marker to see the underlying
          payload and jump to the originating transaction.
        </Body1>
      </div>
      <div className={styles.content}>
        <GovernanceTimeline
          events={events ?? []}
          isLoading={isLoading}
          error={error instanceof Error ? error : null}
        />
      </div>
    </div>
  );
};

export default GovernancePage;
