import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type LoginMode = 'visitor' | 'admin';

// A stored visitor token from a previous visit — silently re-identifies and
// bounces straight past the login card if it's still good. Not react-query:
// there's no data to render here, just a one-shot redirect side effect.
export function useVisitorAutoLogin(mode: LoginMode) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('sd_visitor_token');
    if (!token || mode === 'admin') return;
    fetch('/api/visitors/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (r.status === 403) {
          const body = await r.json().catch(() => ({}));
          if (body.error === 'blocked') navigate('/blocked', { replace: true });
          return;
        }
        if (r.ok) {
          const data = await r.json();
          if (data) navigate('/', { replace: true });
        }
      })
      .catch(() => {});
  }, [mode, navigate]);
}
