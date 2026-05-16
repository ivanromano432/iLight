import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './storage-polyfill.js';
import AuthGate from './AuthGate.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </StrictMode>
);
