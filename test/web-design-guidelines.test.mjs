import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("public pages expose a skip link and main-content target", async () => {
  const pages = ["index.html", "schedule.html", "about.html", "contact.html", "portfolio.html"];

  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /class="skip-link" href="#main-content"/);
    assert.match(html, /<main id="main-content">/);
  }
});

test("public navigation targets the homepage Programs section", async () => {
  const pages = [
    "index.html",
    "about.html",
    "account.html",
    "checkout-success.html",
    "contact.html",
    "enroll.html",
    "login.html",
    "portfolio.html",
    "registration.html",
    "schedule.html",
    "signup.html",
  ];

  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /href="index\.html#programs">Programs<\/a>/, `${page} should link to homepage Programs`);
    assert.doesNotMatch(html, /href="programs\.html(?:#[^"]*)?"/);
  }
});

test("standalone Programs page has been removed", async () => {
  await assert.rejects(read("programs.html"), { code: "ENOENT" });
});

test("shared styles preserve keyboard focus and reduce motion", async () => {
  const css = await read("css/style.css");

  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /transition:\s*all/);
});

test("homepage presents the complete Programs flow in the revised order", async () => {
  const index = await read("index.html");
  assert.match(
    index,
    /<section id="programs" class="programs-overview">\s*<div class="container programs-intro">/,
  );
  assert.match(index, /<div class="container age-mapping">/);

  const orderedMarkers = [
    'id="programs"',
    'class="container age-mapping"',
    'class="container philosophy-teaser"',
    'class="cta-banner"',
    'id="visual-discovery"',
    'id="young-photographer"',
    'id="creative-foundations"',
    'id="portfolio-studio"',
  ];

  let previousPosition = -1;
  for (const marker of orderedMarkers) {
    const position = index.indexOf(marker);
    assert.ok(position > previousPosition, `${marker} should appear in the revised homepage order`);
    previousPosition = position;
  }

  assert.match(index, /assets\/art-class\/artPortfolio1\.jpg/);
  assert.match(
    index,
    /src="assets\/art-class\/artPortfolio1\.jpg"\s+alt="Colorful student painting" width="1592" height="1318"/,
  );
  assert.match(index, /<h2>Young Photographer Camp<\/h2>/);
  assert.doesNotMatch(index, /class="teaser-grid"/);
});

test("homepage anchors clear the sticky navigation", async () => {
  const css = await read("css/style.css");
  assert.match(css, /#programs,\s*\.program-section\s*\{[^}]*scroll-margin-top:\s*88px/s);

  const programPhotoRule = css.indexOf(".program-photo {");
  const mobileProgramLayout = css.indexOf("@media (max-width: 800px)");
  assert.ok(programPhotoRule !== -1 && programPhotoRule < mobileProgramLayout);
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
  const [about, contact, portfolio, index, qr] = await Promise.all([
    read("about.html"),
    read("contact.html"),
    read("portfolio.html"),
    read("index.html"),
    read("qr-code.html"),
  ]);

  assert.match(about, /<h2><img src="assets\/Olivia_teaching\.png" alt="Olivia Liu" width="306" hspace="10" height="240" align="left"><\/h2>/);
  assert.match(contact, /wechat-qr\.png"[^>]*width="344"[^>]*height="344"/);
  assert.match(qr, /alt="QR Code"[^>]*width="512"[^>]*height="512"/);
  assert.match(portfolio, /class="portfolio-thumb" type="button" aria-label="Open Visual Discovery artwork 1"/);
  assert.doesNotMatch(index, /alt="kids draw"|alt="color painting"/);
});
