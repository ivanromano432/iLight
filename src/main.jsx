import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './storage-polyfill.js';
import AuthGate from './AuthGate.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

// Fallback minimale mostrato quando un chunk lazy si sta caricando
function LazyFallback() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1F140C',color:'#C9A876',fontFamily:'serif',fontStyle:'italic',fontSize:14,letterSpacing:'0.2em'}}>
      ⋯
    </div>
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
