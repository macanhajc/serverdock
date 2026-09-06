import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registers the same worker SettingsPage uses for push — doing it here too
// makes the public dashboard installable as a PWA even for visitors who never
// touch push notifications. No-ops under plain HTTP (non-secure contexts
// don't expose navigator.serviceWorker at all).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
