import '@fontsource-variable/inter';
import './styles.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { rememberReferrer } from './lib/growth';
import { queryClient } from './lib/queryClient';
import { rememberLanding } from './lib/origin';
import { startAppMode } from './lib/standalone';
import { startAuth } from './store/auth';
import { startInstall } from './store/install';

const client = queryClient;

// A tab left open across a deploy asks for files that are gone: reload once into the new release.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('wavee.reloaded')) return;
    sessionStorage.setItem('wavee.reloaded', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

rememberReferrer();
rememberLanding();
startAuth();
startAppMode();
startInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        {/* Animations calm down for people who ask their phone for less motion. */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
