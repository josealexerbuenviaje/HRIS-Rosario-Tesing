// ============================================================
//  src/auth.js  —  Shared JWT helper for HRIS + User Management
//
//  SECURITY POSTURE (current — Bearer token via sessionStorage):
//  ─────────────────────────────────────────────────────────────
//  • Token is in sessionStorage (not localStorage): cleared on
//    tab close, not readable cross-origin, still XSS-readable.
//  • TODO (Phase 2): migrate server to set httpOnly cookie so
//    JS never touches the raw token at all.
//
//  • CSRF: not required while using Authorization header
//    (CSRF attacks can't set custom headers cross-origin).
//
//  • All console.log calls are no-ops in production.
//  • All fetches have a 10 s timeout via AbortController.
//  • JWT payload is decoded client-side only for UX (expiry
//    warnings). Signature verification is always server-side.
// ============================================================

const HRIS_API_BASE = import.meta.env.VITE_API_BASE;
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE;
const IS_DEV        = import.meta.env.DEV;

// ── Storage keys (sessionStorage — clears on tab close) ──────────────────────
const TOKEN_KEY   = "hris_token";
const USER_KEY    = "hris_user";
const LOG_ID_KEY  = "login_log_id";

// ── Dev-only logging ──────────────────────────────────────────────────────────
const devLog  = (...a) => IS_DEV && console.log(...a);
const devWarn = (...a) => IS_DEV && console.warn(...a);

// ── Token storage (sessionStorage) ───────────────────────────────────────────
export const saveToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const getToken  = ()      => sessionStorage.getItem(TOKEN_KEY);

export const saveUser  = (user)  => sessionStorage.setItem(USER_KEY, JSON.stringify(user));
export const getUser   = ()      => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY)); }
  catch { return null; }
};

export const saveLoginLogId = (id) => sessionStorage.setItem(LOG_ID_KEY, String(id));
export const getLoginLogId  = ()   => sessionStorage.getItem(LOG_ID_KEY);

// clearToken — exported so ProtectedRoute and other callers can use it
export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(LOG_ID_KEY);
};

// ── Fetch with timeout ────────────────────────────────────────────────────────
const TIMEOUT_MS = 10_000;

function fetchWithTimeout(url, options = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

// ── Decode JWT payload (UX only — NOT for trust/auth decisions) ───────────────
export function decodeToken(token) {
  try {
    // Handles both standard Base64 and Base64URL
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// ── Token expiry helpers ──────────────────────────────────────────────────────
export function isLoggedIn() {
  const token = getToken();
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload?.exp) return false;
  return payload.exp > Math.floor(Date.now() / 1000);
}

export function getTokenExpiry() {
  const payload = decodeToken(getToken());
  return payload?.exp ? new Date(payload.exp * 1000) : null;
}

export function secondsUntilExpiry() {
  const payload = decodeToken(getToken());
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const res  = await fetchWithTimeout(`${AUTH_API_BASE}/login.php`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });

  const json = await res.json();

  if (json.success) {
    saveToken(json.token);
    saveUser(json.user);
    if (json.login_log_id) saveLoginLogId(json.login_log_id);
    scheduleTokenRefresh();
  }

  return json;
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logout({ redirectTo = "/login" } = {}) {
  const logId = getLoginLogId();
  const token = getToken();

  try {
    if (logId) {
      await fetchWithTimeout(`${AUTH_API_BASE}/logout.php`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ login_log_id: logId }),
      });
    }
  } catch (err) {
    devWarn("Logout logging failed:", err);
  }

  clearToken();
  clearRefreshTimer();

  if (redirectTo && typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────
export async function refreshToken() {
  const token = getToken();
  if (!token) return false;

  try {
    const res  = await fetchWithTimeout(`${AUTH_API_BASE}/refresh_token.php`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    if (json.success && json.token) {
      saveToken(json.token);
      scheduleTokenRefresh();
      return true;
    }
  } catch (e) {
    devWarn("Token refresh failed:", e);
  }

  await logout();
  return false;
}

// ── Auto-refresh — 5 minutes before expiry ───────────────────────────────────
let refreshTimer = null;

export function scheduleTokenRefresh() {
  clearRefreshTimer();

  const secsLeft = secondsUntilExpiry();
  if (secsLeft <= 0) return;

  // If already inside the 5-min window, refresh immediately
  if (secsLeft <= 300) {
    refreshToken();
    return;
  }

  refreshTimer = setTimeout(async () => {
    devLog("🔄 Auto-refreshing JWT token…");
    await refreshToken();
  }, (secsLeft - 300) * 1000);
}

export function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// ── authFetch — HRIS backend ──────────────────────────────────────────────────
export async function authFetch(endpoint, options = {}) {
  const token       = getToken();
  const baseUrl     = (HRIS_API_BASE || "").replace(/\/$/, "");
  const cleanPath   = endpoint.replace(/^\//, "");
  const url         = `${baseUrl}/${cleanPath}`;

  devLog("🔗 authFetch →", options.method || "GET", url);

  try {
    const res = await fetchWithTimeout(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    devLog("📡", res.status, res.statusText);

    if (res.status === 401) {
      devWarn("⚠️ 401 — session expired");
      await logout();
      return null;
    }

    return res;
  } catch (err) {
    const msg = err.name === "AbortError" ? "timed out" : err.message;
    console.error(`❌ authFetch error (${msg}):`, url);
    throw err;
  }
}

// ── authFetchAuthSystem — User Management backend ─────────────────────────────
export async function authFetchAuthSystem(endpoint, options = {}) {
  const token     = getToken();
  const baseUrl   = (AUTH_API_BASE || "").replace(/\/$/, "");
  const cleanPath = endpoint.replace(/^\//, "");
  const url       = `${baseUrl}/${cleanPath}`;

  devLog("🔗 authFetchAuthSystem →", options.method || "GET", url);

  try {
    const res = await fetchWithTimeout(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    devLog("📡", res.status, res.statusText);

    if (res.status === 401) {
      await logout();
      return null;
    }

    return res;
  } catch (err) {
    const msg = err.name === "AbortError" ? "timed out" : err.message;
    console.error(`❌ authFetchAuthSystem error (${msg}):`, url);
    throw err;
  }
}

// ── Init — call once on app start ─────────────────────────────────────────────
export function initAuth() {
  if (isLoggedIn()) {
    scheduleTokenRefresh();
  }
}