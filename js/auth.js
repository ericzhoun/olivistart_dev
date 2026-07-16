// Auth helpers - email/password and magic-link auth against the Butterbase
// backend, tokens cached in localStorage. Ported from herfield app/lib/auth.js.
import { AUTH_BASE, API_BASE } from "./api.js";

const TOKEN_KEY = "olivistart_access_token";
const REFRESH_KEY = "olivistart_refresh_token";
const USER_KEY = "olivistart_user";

/** Get stored access token */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Get stored refresh token */
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/** Get cached user profile */
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Check if user is logged in */
export function isLoggedIn() {
  return !!getToken();
}

/** Check if current user is admin (Olivia's email) */
export function isAdmin() {
  const user = getUser();
  return user?.email === "herfield8@gmail.com" || user?.email === "lightbyolivia@gmail.com";
}

/** Login with email + password */
export async function login(email, password) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Login failed");
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

/** Signup with email + password + display name */
export async function signup(email, password, displayName) {
  const res = await fetch(`${AUTH_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Signup failed");
  // After signup, login to get tokens (verification email is sent automatically)
  await login(email, password);
  return getUser();
}

/** Email a 6-digit sign-in code (works for new and existing accounts). */
export async function sendMagicLink(email) {
  const res = await fetch(`${AUTH_BASE}/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Could not send code");
  return data;
}

/**
 * Exchange a 6-digit code for tokens. Creates the account on first use,
 * signs into the existing account otherwise. Stores tokens like login().
 */
export async function verifyMagicLink(email, code) {
  const res = await fetch(`${AUTH_BASE}/magic-link/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Invalid code");
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

/**
 * Attach any unclaimed enrollments matching the logged-in user's verified
 * email. Best-effort: returns claimed ids, or [] on any failure.
 */
export async function claimEnrollments() {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE}/fn/claim-enrollments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const data = await res.json();
    if (!res.ok) return [];
    return data.claimed || [];
  } catch {
    return [];
  }
}

/** Logout — revokes tokens and clears localStorage */
export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore — clear local state regardless
    }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Refresh the access token using the refresh token */
export async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(`${AUTH_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const data = await res.json();
  if (!res.ok) {
    await logout();
    return null;
  }
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.access_token;
}

/**
 * Require a logged-in user. If not logged in, redirect to login with a
 * return-to pointer back to the current page. Returns the user or null.
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    const here = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?next=${here}`;
    return null;
  }
  return getUser();
}
