import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './interactions.css';

async function mount() {
  if (import.meta.env.DEV && !window.booth) {
    const { createBrowserTrialBridge } = await import('./browserTrial');
    window.booth = createBrowserTrialBridge();
  }
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
void mount();
