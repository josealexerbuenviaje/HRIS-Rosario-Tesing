import { createContext, useCallback, useRef, useState } from "react";

export const ToastContext = createContext(null);

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 4;

// success/info auto-dismiss after AUTO_DISMISS_MS.
// error/warning stay on screen until the user closes them, since those
// usually need to be read or acted on.
const AUTO_DISMISS_TYPES = new Set(["success", "info"]);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // showToast(title, type, description?)
  //   type: "success" | "error" | "warning" | "info" (defaults to "info")
  const showToast = useCallback(
    (title, type = "info", description) => {
      const id = ++idRef.current;

      setToasts((prev) => {
        const next = [...prev, { id, type, title, description }];
        // keep only the most recent MAX_VISIBLE toasts on screen
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });

      if (AUTO_DISMISS_TYPES.has(type)) {
        setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
      }

      return id;
    },
    [removeToast]
  );

  const value = { toasts, showToast, removeToast };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
