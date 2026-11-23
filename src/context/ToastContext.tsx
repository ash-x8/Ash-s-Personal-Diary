import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur-md transition-all ${
              toast.variant === 'error'
                ? 'bg-[#1a1112]/95 border-[#d66363]/40 text-[#f5d0d0]'
                : toast.variant === 'success'
                ? 'bg-[#111914]/95 border-[#c5a059]/40 text-[#e8e6e3]'
                : 'bg-[#14171c]/95 border-[#2c313c] text-[#e8e6e3]'
            }`}
          >
            {toast.variant === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#e07b7b] shrink-0 mt-0.5" />
            ) : toast.variant === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#c5a059] shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-[#c5a059] shrink-0 mt-0.5" />
            )}
            <p className="text-xs sm:text-sm leading-snug flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="text-[#8e929b] hover:text-[#e8e6e3] p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
