console.log('Vite Env Variables:', import.meta.env);
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './utils/suppressWarnings';
import { registerPWA } from './utils/pwa';
import toast from 'react-hot-toast';

// Register PWA Service Worker
registerPWA({
  onUpdate: () => {
    toast.success(
      'New version available! The app will reload to update.',
      {
        duration: 5000,
        position: 'bottom-center'
      }
    );
  },
  onSuccess: () => {
    console.log('[PWA] App ready for offline use');
  },
  onOfflineReady: () => {
    toast.success('App ready to work offline!', {
      duration: 3000,
      position: 'bottom-center'
    });
  }
});

createRoot(document.getElementById('root')!).render(
  // <StrictMode> // <-- Temporarily comment out
    <BrowserRouter>
      <App />
    </BrowserRouter>
  // </StrictMode> // <-- Temporarily comment out
);