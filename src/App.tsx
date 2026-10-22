import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { AppRouter } from './routing';
import { useRoutePrefetch } from './hooks/useRoutePrefetch';
import { ThemeProvider } from './contexts/ThemeContext';
import { InstallPrompt } from './components/pwa/InstallPrompt';
// import { BrowserRouter } from 'react-router-dom';

// Rename to App and make default export
function App() {
  useRoutePrefetch();
  
  // Debug: Add visibility change listener to understand page reload issue
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('[App] Visibility changed:', {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        timestamp: new Date().toISOString()
      });
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  // Light mode is now the default via CSS variables in src/index.css
  // Dark mode can be enabled by adding the 'dark' class via ThemeContext (coming next)

  return (
    <ThemeProvider>
      <AuthProvider>
        <DatabaseProvider>
          <AppRouter />
          <InstallPrompt />
        </DatabaseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Remove the old App function
// function App() { ... }

export default App; // Export the correct component