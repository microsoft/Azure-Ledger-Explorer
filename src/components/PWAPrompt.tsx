/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { MessageBar, MessageBarBody, MessageBarActions, Button } from '@fluentui/react-components';

/**
 * PWAPrompt - Component to handle Progressive Web App service worker updates
 * 
 * With autoUpdate enabled, the service worker automatically updates on page load.
 * This component shows a brief notification when the app is ready for offline use.
 */
export function PWAPrompt(): React.ReactElement | null {
  const [showOfflineReady, setShowOfflineReady] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates immediately on registration and periodically
      if (registration) {
        // Check immediately
        registration.update();
        // Then check every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      setShowOfflineReady(true);
      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        setShowOfflineReady(false);
        setOfflineReady(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [offlineReady, setOfflineReady]);

  const handleClose = () => {
    setOfflineReady(false);
    setShowOfflineReady(false);
  };

  if (!showOfflineReady) {
    return null;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      zIndex: 9999,
      maxWidth: '400px'
    }}>
      <MessageBar intent="success">
        <MessageBarBody>
          App ready to work offline
        </MessageBarBody>
        <MessageBarActions>
          <Button appearance="transparent" onClick={handleClose}>
            Dismiss
          </Button>
        </MessageBarActions>
      </MessageBar>
    </div>
  );
}
