import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck } from 'lucide-react';

export default function AuthCallback() {
  const [message, setMessage] = useState('Confirming your secure sign-in…');
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { setMessage('This sign-in link is missing its confirmation code. Please request a new one.'); return; }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setMessage(error ? 'This sign-in link is invalid or has expired. Please return and try again.' : 'Your sign-in is confirmed. You can safely return to your dashboard.');
    });
  }, []);
  return <main className="callback-page"><div className="callback-card"><ShieldCheck size={34}/><h1>UPI Shield AI</h1><p>{message}</p><Link to="/">Return to dashboard</Link></div></main>;
}
