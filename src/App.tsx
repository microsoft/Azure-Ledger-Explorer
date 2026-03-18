/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CCFVisualizerApp } from './components/CCFVisualizerApp';
import { TransactionDetailsPage } from './pages/TransactionDetailsPage';
import TablesPage from './pages/TablesPage';
import StatsPage from './pages/StatsPage';
import { AIPage } from './pages/AIPage';
import { StartPage } from './pages/StartPage';
import { VerificationPage } from './pages/VerificationPage';
import { WriteReceiptVerificationPage } from './pages/WriteReceiptVerificationPage';
import { MstReceiptVerificationPage } from './pages/MstReceiptVerificationPage';
import { CoseViewerPage } from './pages/CoseViewerPage';
import { MenuBar } from './components/MenuBar';
import { PageTransition } from './components/PageTransition';
import GridLayout from './components/AppLayout';
import { ConfigPage } from './pages/ConfigPage';
import { SplashScreen } from './components/SplashScreen';
import { PWAPrompt } from './components/PWAPrompt';
import { VerificationStatusIndicator } from './components/VerificationStatusIndicator';
import { initializeDatabase, resetDatabase } from './hooks/use-ccf-data';
import { TelemetryProvider } from './services/telemetry';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
    },
  },
});

function App(): React.ReactElement {
  // Database initialization state
  const [isDbInitialized, setIsDbInitialized] = useState(false);

  // Initialize dark mode from localStorage or default to false
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('ccf-visualizer-theme');
    return savedTheme === 'dark';
  });

  // Chat state management
  const [, setHasActiveChat] = useState(false);
  const [clearChatFunction, setClearChatFunction] = useState<(() => void) | null>(null);

  const currentTheme = isDarkMode ? webDarkTheme : webLightTheme;

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('ccf-visualizer-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleDatabaseInitialized = useCallback(() => {
    setIsDbInitialized(true);
  }, []);

  // Show splash screen until database is initialized
  if (!isDbInitialized) {
    return (
      <FluentProvider theme={currentTheme}>
        <SplashScreen
          onInitialized={handleDatabaseInitialized}
          initializeDatabase={initializeDatabase}
          resetDatabase={resetDatabase}
        />
      </FluentProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={currentTheme}>
        <Router>
          <TelemetryProvider>
            <GridLayout>
              <GridLayout.Top>
                <MenuBar
                  onToggleTheme={handleToggleTheme}
                  isDarkMode={isDarkMode}
                />
              </GridLayout.Top>
              <GridLayout.Main>
                <PageTransition>
                  <Routes>
                    <Route path="/" element={
                      import.meta.env.VITE_ENABLE_SAGE === 'true'
                        ? <StartPage />
                        : <Navigate to="/files" replace />
                    } />
                    <Route
                      path="/chat"
                      element={
                        <AIPage
                          onChatStateChange={setHasActiveChat}
                          onRegisterClearChat={setClearChatFunction}
                          clearChatFunction={clearChatFunction}
                        />
                      }
                    />
                    <Route path="/files" element={<CCFVisualizerApp />} />
                    <Route path="/tables" element={<TablesPage />} />
                    <Route path="/tables/:tableName" element={<TablesPage />} />
                    <Route path="/stats" element={<StatsPage />} />
                    <Route path="/verification" element={<VerificationPage />} />
                    <Route path="/write-receipt" element={<WriteReceiptVerificationPage />} />
                    <Route path="/mst-receipt" element={<MstReceiptVerificationPage />} />
                    <Route path="/cose-viewer" element={<CoseViewerPage />} />
                    <Route path="/transaction/:transactionId" element={<TransactionDetailsPage />} />
                    <Route path="/config" element={<ConfigPage />} />
                  </Routes>
                </PageTransition>
              </GridLayout.Main>
            </GridLayout>
            <PWAPrompt />
            <VerificationStatusIndicator />
          </TelemetryProvider>
        </Router>
      </FluentProvider>
    </QueryClientProvider>
  );
}

export default App;
