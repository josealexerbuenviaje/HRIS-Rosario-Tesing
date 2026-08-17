import React, { useState, useCallback, useRef } from "react";
import "../css_components/ConfirmDialog.css";

// ============================================================
//  useConfirm — drop-in replacement for window.confirm()
//
//  Usage:
//    const { confirm, ConfirmDialog } = useConfirm();
//
//    const handleDelete = async () => {
//      const ok = await confirm("Delete this record?");
//      if (!ok) return;
//      // ...proceed with delete
//    };
//
//    return (
//      <>
//        <button onClick={handleDelete}>Delete</button>
//        {ConfirmDialog}
//      </>
//    );
// ============================================================
export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    message: "",
    danger: false,
  });
  const resolver = useRef(null);

  const confirm = useCallback((message, { danger = true } = {}) => {
    setState({ open: true, message, danger });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleClose = (result) => {
    setState((s) => ({ ...s, open: false }));
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  };

  const ConfirmDialog = state.open ? (
    <div className="cf-overlay" onClick={(e) => e.target === e.currentTarget && handleClose(false)}>
      <div className="cf-modal">
        <div className={`cf-icon${state.danger ? " cf-icon--danger" : ""}`}>
          {state.danger ? "⚠️" : "❓"}
        </div>
        <p className="cf-message">{state.message}</p>
        <div className="cf-actions">
          <button className="cf-btn cf-btn--cancel" onClick={() => handleClose(false)}>
            Cancel
          </button>
          <button
            className={`cf-btn ${state.danger ? "cf-btn--danger" : "cf-btn--confirm"}`}
            onClick={() => handleClose(true)}
          >
            {state.danger ? "Delete" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
