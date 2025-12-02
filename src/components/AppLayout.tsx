/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { type ReactNode } from 'react';
import { makeStyles, mergeClasses } from '@fluentui/react-components';

const useStyles = makeStyles({
  layout: {
    display: 'grid',
    gridTemplateAreas: `
      "top top top"
      "left main right"
      "bottom bottom bottom"
    `,
    gridTemplateRows: 'auto 1fr auto',
    gridTemplateColumns: 'auto 1fr auto',
    height: '100vh',
  },
  top: { 
    gridArea: 'top',
  },
  left: { 
    gridArea: 'left',
  },
  main: { 
    gridArea: 'main',
    overflow: 'hidden',
    minHeight: '50vh',
  },
  right: { 
    gridArea: 'right',
  },
  bottom: { 
    gridArea: 'bottom',
  },
});

interface LayoutProps {
  children: ReactNode;
}

interface ChildProps {
  children: ReactNode;
  className?: string;
}

const GridLayout: React.FC<LayoutProps> & {
  Top: React.FC<ChildProps>;
  Left: React.FC<ChildProps>;
  Main: React.FC<ChildProps>;
  Right: React.FC<ChildProps>;
  Bottom: React.FC<ChildProps>;
} = ({ children }) => {
  const styles = useStyles();

  return <div className={styles.layout}>{children}</div>;
};

const Top: React.FC<ChildProps> = ({ children, className }) => {
  const styles = useStyles();
  return <div className={mergeClasses(styles.top, className)}>{children}</div>;
};

const Left: React.FC<ChildProps> = ({ children, className }) => {
  const styles = useStyles();
  return <div className={mergeClasses(styles.left, className)}>{children}</div>;
};

const Main: React.FC<ChildProps> = ({ children, className }) => {
  const styles = useStyles();
  return <div className={mergeClasses(styles.main, className)}>{children}</div>;
};

const Right: React.FC<ChildProps> = ({ children, className }) => {
  const styles = useStyles();
  return <div className={mergeClasses(styles.right, className)}>{children}</div>;
};

const Bottom: React.FC<ChildProps> = ({ children, className }) => {
  const styles = useStyles();
  return <div className={mergeClasses(styles.bottom, className)}>{children}</div>;
};

GridLayout.Top = Top;
GridLayout.Left = Left;
GridLayout.Main = Main;
GridLayout.Right = Right;
GridLayout.Bottom = Bottom;

export default GridLayout;
