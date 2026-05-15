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

  return <App user={session.user} onLogout={async () => { await supabase.auth.signOut(); }} />;
}
