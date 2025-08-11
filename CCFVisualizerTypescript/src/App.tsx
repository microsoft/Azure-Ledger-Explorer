import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CCFVisualizerApp } from './components/CCFVisualizerApp';
import { TransactionDetailsPage } from './pages/TransactionDetailsPage';
import TablesPage from './pages/TablesPage';
import StatsPage from './pages/StatsPage';
import { AIPage } from './pages/AIPage';
import { MenuBar } from './components/MenuBar';
import GridLayout from './components/AppLayout';
import { ConfigPage } from './pages/ConfigPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
    },
  },
});

function App() {
  // Initialize dark mode from localStorage or default to false
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('ccf-visualizer-theme');
    return savedTheme === 'dark';
  });
  
  const currentTheme = isDarkMode ? webDarkTheme : webLightTheme;

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('ccf-visualizer-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={currentTheme}>
        <Router>
          <GridLayout>
            <GridLayout.Top>
              <MenuBar onToggleTheme={handleToggleTheme} isDarkMode={isDarkMode} />
            </GridLayout.Top>
            <GridLayout.Main>
              <Routes>
                <Route path="/" element={<CCFVisualizerApp />} />
                <Route path="/tables" element={<TablesPage />} />
                <Route path="/tables/:tableName" element={<TablesPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/ai" element={<AIPage />} />
                <Route path="/transaction/:transactionId" element={<TransactionDetailsPage />} />
                <Route path="/config" element={<ConfigPage />} />
              </Routes>
            </GridLayout.Main>
          </GridLayout>
        </Router>
      </FluentProvider>
    </QueryClientProvider>
  );
}

export default App;
 