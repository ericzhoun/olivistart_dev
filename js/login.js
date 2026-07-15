// Login page logic. Ported from herfield app/login/page.js.
import { login, isLoggedIn } from "./auth.js";
import { getQueryParam } from "./api.js";

const errEl = document.getElementById("auth-error");
const form = document.getElementById("login-form");
const btn = form.querySelector("button[type=submit]");

// Already logged in? Bounce to the return target (or account).
if (isLoggedIn()) {
  const next = getQueryParam("next");
  window.location.href = next || "account.html";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  btn.disabled = true;
  btn.textContent = "Logging in…";
  try {
    await login(email, password);
    const next = getQueryParam("next");
    window.location.href = next || "account.html";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "Log In";
  }
});
