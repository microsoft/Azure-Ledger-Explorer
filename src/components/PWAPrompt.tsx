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
 * Displays a prompt when a new version of the app is available,
 * allowing users to update immediately or continue using the current version.
 */
export function PWAPrompt() {
  const [showReload, setShowReload] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('Service Worker registered:', swUrl);
      
      // Check for updates every hour
      if (registration) {
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
      console.log('App ready to work offline');
    }
  }, [offlineReady]);

  useEffect(() => {
    if (needRefresh) {
      setShowReload(true);
    }
  }, [needRefresh]);

  const handleClose = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    setShowReload(false);
  };

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  if (!offlineReady && !showReload) {
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
      {offlineReady && !showReload && (
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
      )}

      {showReload && (
        <MessageBar intent="info">
          <MessageBarBody>
            New version available! Click reload to update.
          </MessageBarBody>
          <MessageBarActions>
            <Button appearance="primary" onClick={handleUpdate}>
              Reload
            </Button>
            <Button appearance="transparent" onClick={handleClose}>
              Later
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
    </div>
  );
}
