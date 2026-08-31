import { useContext } from "react";
import { ToastContext } from "./ToastContext";

// Usage inside any component under <ToastProvider>:
//   const { showToast } = useToast();
//   showToast("Employee saved", "success", "Maria Santos added to Engineering.");
//   showToast("Could not save employee", "error", err.message);
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be called inside a <ToastProvider>");
  }
  return ctx;
}
