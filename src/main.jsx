import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './storage-polyfill.js';
import AuthGate from './AuthGate.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>
);
