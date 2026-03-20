/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { BlobManagedAppExplorer } from '../components/BlobManagedAppExplorer';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: tokens.spacingVerticalXXL,
  },
});

export const BlobAppPage: React.FC = () => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <BlobManagedAppExplorer />
      </div>
    </div>
  );
};
