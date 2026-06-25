import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in public/index.html');
}

const root = createRoot(container);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  // Surface fatal render errors directly in the page instead of a blank screen.
  console.error('Failed to render Interview Platform:', error);
  container.innerHTML =
    '<div style="font-family: -apple-system, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; text-align: center;">' +
    '<h1 style="color:#dc2626;">Something went wrong</h1>' +
    '<p>The app failed to start. Try refreshing the page. If the problem persists, clear your browser cache for this site.</p>' +
    '</div>';
}
