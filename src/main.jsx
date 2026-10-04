import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './storage-polyfill.js';
import AuthGate from './AuthGate.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

// Fallback minimale mostrato quando un chunk lazy si sta caricando
function LazyFallback() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(180deg, #4A6A62 0px, #24405A 260px, #0E2240 540px)',color:'#F4EFE2',fontFamily:"'EB Garamond',serif",fontSize:44}}>GoalFit</div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LazyFallback />}>
        <AuthGate />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);
