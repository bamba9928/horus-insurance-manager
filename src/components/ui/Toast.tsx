import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "error" | "info";

interface ToastOptions {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends Required<ToastOptions> {
  id: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4500;

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2;
    container: string;
    iconClass: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    container:
      "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100",
    iconClass: "text-green-700 dark:text-green-300",
  },
  error: {
    icon: AlertTriangle,
    container:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100",
    iconClass: "text-red-700 dark:text-red-300",
  },
  info: {
    icon: Info,
    container:
      "border-[#614e1a]/20 bg-[#614e1a]/5 text-gray-900 dark:border-[#c9a961]/20 dark:bg-[#614e1a]/15 dark:text-slate-100",
    iconClass: "text-[#614e1a] dark:text-[#c9a961]",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const id = nextId.current;
    nextId.current += 1;
    const toast: ToastItem = {
      id,
      title: options.title ?? "",
      message: options.message,
      variant: options.variant ?? "info",
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    };
    setToasts((current) => [...current, toast].slice(-4));
    return id;
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:top-5 sm:right-5"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.durationMs, toast.id]);

  const variant = VARIANT_STYLES[toast.variant];
  const Icon = variant.icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-lg backdrop-blur ${variant.container}`}
      role={toast.variant === "error" ? "alert" : "status"}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${variant.iconClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title && <div className="font-semibold">{toast.title}</div>}
        <div className={toast.title ? "mt-0.5 text-sm opacity-90" : "text-sm opacity-90"}>
          {toast.message}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        aria-label="Fermer la notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
