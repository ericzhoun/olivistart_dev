import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("public pages expose a skip link and main-content target", async () => {
  const pages = ["index.html", "programs.html", "schedule.html", "about.html", "contact.html", "portfolio.html"];

  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /class="skip-link" href="#main-content"/);
    assert.match(html, /<main id="main-content">/);
  }
});

test("shared styles preserve keyboard focus and reduce motion", async () => {
  const css = await read("css/style.css");

  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /transition:\s*all/);
});

test("auth fields include meaningful names, autocomplete, and live status", async () => {
  const [login, signup] = await Promise.all([read("login.html"), read("signup.html")]);

  assert.match(login, /name="email"[^>]*autocomplete="email"[^>]*spellcheck="false"/);
  assert.match(login, /name="password"[^>]*autocomplete="current-password"/);
  assert.match(signup, /name="name"[^>]*autocomplete="name"/);
  assert.match(signup, /id="auth-error"[^>]*aria-live="polite"/);
  assert.match(signup, /id="auth-info"[^>]*aria-live="polite"/);
});

test("content images and controls have stable, meaningful semantics", async () => {
  const [about, contact, portfolio, programs, qr] = await Promise.all([
    read("about.html"),
    read("contact.html"),
    read("portfolio.html"),
    read("programs.html"),
    read("qr-code.html"),
  ]);

  assert.match(about, /<h2><img src="assets\/Olivia_teaching\.png" alt="Olivia Liu" width="306" hspace="10" height="240" align="left"><\/h2>/);
  assert.match(contact, /wechat-qr\.png"[^>]*width="344"[^>]*height="344"/);
  assert.match(qr, /alt="QR Code"[^>]*width="512"[^>]*height="512"/);
  assert.match(portfolio, /class="portfolio-thumb" type="button" aria-label="Open Visual Discovery artwork 1"/);
  assert.doesNotMatch(programs, /alt="kids draw"|alt="color painting"/);
});
