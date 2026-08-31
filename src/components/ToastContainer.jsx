import { useContext } from "react";
import { ToastContext } from "./ToastContext";
import "../css_components/ToastContainer.css";

const ICONS = {
  success: "ti-circle-check",
  error: "ti-circle-x",
  warning: "ti-alert-triangle",
  info: "ti-info-circle",
};

export function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`} role="status">
          <i className={`ti ${ICONS[toast.type] || ICONS.info} toast__icon`} aria-hidden="true" />
          <div className="toast__body">
            <p className="toast__title">{toast.title}</p>
            {toast.description && <p className="toast__description">{toast.description}</p>}
          </div>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss notification"
            onClick={() => removeToast(toast.id)}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
