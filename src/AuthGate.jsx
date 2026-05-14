import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { setCurrentUserId, installSupabaseStorage, wipeMigratedLocalStorage } from './supabase-storage.js';
import App from './App.jsx';
import AuthScreen from './AuthScreen.jsx';

const fCardo = "'Cardo',serif";
const W_bg = '#E8E0D2';
const W_ink = '#3C3329';
const W_tan = '#8C6A4E';

export default function AuthGate() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session;
      if (s) {
        // Installa storage Supabase prima di mostrare l'App
        setCurrentUserId(s.user.id);
        wipeMigratedLocalStorage();   // opzione B: pulisce localStorage delle chiavi cloud
        installSupabaseStorage();
      }
      setSession(s);
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      if (newSession) {
        setCurrentUserId(newSession.user.id);
        wipeMigratedLocalStorage();
        installSupabaseStorage();
      } else {
        setCurrentUserId(null);
      }
      setSession(newSession);
      setShowMenu(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: W_bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: fCardo, fontStyle: 'italic', fontSize: 20, color: W_tan,
      }}>...</div>
    );
  }

  if (!session) return <AuthScreen />;

  const email = session.user?.email || '';
  const initial = (email[0] || '?').toUpperCase();

  return (
    <>
      <App />

      {/* Pulsante account (in alto a destra, discreto) */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9000 }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          aria-label="account"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(232,224,210,0.85)',
            border: `1px solid ${W_ink}33`,
            color: W_ink,
            fontFamily: fCardo,
            fontSize: 16,
            fontStyle: 'italic',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          {initial}
        </button>

        {showMenu && (
          <div style={{
            position: 'absolute',
            top: 44, right: 0,
            background: W_bg,
            border: `1px solid ${W_ink}33`,
            padding: '14px 18px',
            minWidth: 200,
            fontFamily: fCardo,
            color: W_ink,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: W_tan, marginBottom: 4 }}>
              connesso come
            </div>
            <div style={{ fontSize: 15, marginBottom: 14, wordBreak: 'break-all' }}>{email}</div>
            <button
              onClick={logout}
              style={{
                background: W_ink,
                color: W_bg,
                border: 'none',
                fontFamily: fCardo,
                fontStyle: 'italic',
                fontSize: 14,
                padding: '8px 18px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              esci
            </button>
          </div>
        )}
      </div>

      {/* Click fuori per chiudere il menu */}
      {showMenu && (
        <div
          onClick={() => setShowMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 8999, background: 'transparent' }}
        />
      )}
    </>
  );
}
