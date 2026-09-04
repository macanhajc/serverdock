import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Visitor {
  username: string;
}

// Runs once on mount: identifies against a stored visitor token (or
// registers a brand-new anonymous one if there isn't a token yet), then
// either reveals the dashboard or bounces the browser to /blocked or /auth.
// Not react-query — the outcome is a one-shot redirect/gate, not data to
// cache or refetch.
export function useVisitorIdentify() {
  const navigate = useNavigate();
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [identifying, setIdentifying] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sd_visitor_token');
    fetch('/api/visitors/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token ?? undefined }),
    })
      .then(async (r) => {
        if (r.status === 403) {
          const body = await r.json().catch(() => ({}));
          navigate(body.error === 'blocked' ? '/blocked' : '/auth', { replace: true });
          return;
        }
        if (!r.ok) {
          navigate('/auth', { replace: true });
          return;
        }
        const data = await r.json();
        localStorage.setItem('sd_visitor_token', data.token);
        setVisitor({ username: data.username });
      })
      .catch(() => navigate('/auth', { replace: true }))
      .finally(() => setIdentifying(false));
  }, [navigate]);

  return { visitor, identifying };
}
