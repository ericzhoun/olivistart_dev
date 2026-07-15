// Signup page logic. Ported from herfield app/signup/page.js.
import { signup, isLoggedIn } from "./auth.js";
import { getQueryParam } from "./api.js";

const errEl = document.getElementById("auth-error");
const form = document.getElementById("signup-form");
const btn = form.querySelector("button[type=submit]");

// Already logged in? Bounce to the return target (or account).
if (isLoggedIn()) {
  const next = getQueryParam("next");
  window.location.href = next || "account.html";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (password.length < 8) {
    errEl.textContent = "Password must be at least 8 characters.";
    errEl.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating account…";
  try {
    await signup(email, password, name);
    const next = getQueryParam("next");
    window.location.href = next || "account.html";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "Sign Up";
  }
});
