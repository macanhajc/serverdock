import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Errors must not vanish before they're read
const DURATION: Record<ToastVariant, number> = { success: 3000, info: 4000, error: 8000 };

function ToastBanner({ id, message, variant, onDismiss }: Toast & { onDismiss: (id: string) => void }) {
  const colorCls =
    variant === 'success' ? 'text-green' : variant === 'error' ? 'text-red' : 'text-ink-2';
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border font-mono text-[11.5px] min-w-60 max-w-95 ${colorCls}`}
      style={{
        background:
          variant === 'success'
            ? 'color-mix(in oklab, var(--green) 10%, var(--bg-1))'
            : variant === 'error'
              ? 'color-mix(in oklab, var(--red) 10%, var(--bg-1))'
              : 'var(--bg-1)',
        borderColor:
          variant === 'success'
            ? 'color-mix(in oklab, var(--green) 40%, transparent)'
            : variant === 'error'
              ? 'color-mix(in oklab, var(--red) 40%, transparent)'
              : 'var(--line)',
        boxShadow: '0 4px 16px color-mix(in oklab, #000 60%, transparent)',
      }}
    >
      <span className="flex-1">{message}</span>
      <button
        className="text-ink-3 hover:text-ink cursor-pointer shrink-0"
        onClick={() => onDismiss(id)}
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'success', duration?: number) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), duration ?? DURATION[variant]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastBanner {...t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
