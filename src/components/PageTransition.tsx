/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSharedStyles } from '../styles/design-system';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Extracts the base route from a pathname for transition keying.
 * This ensures that navigating within the same page (e.g., /tables/foo to /tables/bar)
 * does not trigger a full remount, while navigating between different pages does.
 */
const getRouteKey = (pathname: string): string => {
  // Split path and get the first meaningful segment
  const segments = pathname.split('/').filter(Boolean);
  
  // For paths like /tables/:tableName, use just '/tables' as the key
  // For paths like /transaction/:id, use just '/transaction'
  // For root path, use '/'
  if (segments.length === 0) return '/';
  
  return `/${segments[0]}`;
};

/**
 * Wrapper component that applies a subtle entrance animation when the route changes.
 * Uses the centralized page transition settings from design-system.ts.
 * 
 * The animation is triggered by using the base route as a key, which causes
 * React to remount the wrapper only when navigating to a different page.
 * Navigating within the same page (e.g., between different tables) does not
 * trigger a remount.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const styles = useSharedStyles();
  const routeKey = getRouteKey(location.pathname);
  
  return (
    <div key={routeKey} className={styles.pageTransitionWrapper}>
      {children}
    </div>
  );
};

export default PageTransition;
