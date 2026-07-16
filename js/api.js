// Backend API config — shared across all pages.
// The backend lives at herfield.butterbase.ai (app_48ul5eszfv7v).
export const APP_ID = "app_48ul5eszfv7v";
export const API_BASE = `https://api.butterbase.ai/v1/${APP_ID}`;
export const AUTH_BASE = `https://api.butterbase.ai/auth/${APP_ID}`;
export const SITE_URL = "https://olivistart.com";
export const ADMIN_KEY = "bb_sk_f13dbc117c3c7cb653e416dea8c706be7e800a9e";

/**
 * Fetch wrapper for Butterbase REST API with public (anon) access.
 * No auth header — relies on RLS public read policies.
 * Pass an optional JWT token to read private rows (e.g. own enrollments).
 */
export async function apiGet(path, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/${path}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function adminApi(path, options = {}) {
  const method = options.method || "GET";
  const headers = { Authorization: `Bearer ${ADMIN_KEY}`, ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`Admin API error ${res.status}: ${await res.text()}`);
  return method === "DELETE" ? true : res.json();
}

/**
 * Call a Butterbase serverless function (enroll-guard, book-class) with auth.
 */
export async function callFunction(name, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/fn/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Function error: ${res.status}`);
  return data;
}

/** Format cents to dollar string: 5500 → "$55.00" */
export function formatPrice(cents) {
  if (cents == null) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format time from "16:00" to "4:00 PM" */
export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

/** Read a query-string param from the current URL. */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
