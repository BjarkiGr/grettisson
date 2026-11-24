// PRISM — app.js
// Entry module shared by all pages. Phase 6 responsibilities:
// 1. AUTH GATE: every page except login requires a signed-in session.
//    Signed-out visitors are redirected to login.html — no snooping.
// 2. Initialize navigation and the session indicator.
// 3. Route to the page module declared by <body data-page="...">.

import { config, isConfigured } from "./config.js";
import { initNavigation } from "./navigation.js";
import { getSession, onAuthChange } from "./auth.js";
import { errorState } from "./components.js";

const PAGE_MODULES = {
  overview: "./dashboard.js",
  events: "./events.js",
  "event-detail": "./event-detail.js",
  regions: "./regions.js",
  commodities: "./commodities.js",
  watchlists: "./watchlists.js",
  login: "./auth.js",
  settings: "./settings.js",
};

function renderAuthStatus(session) {
  const footer = document.querySelector(".app-footer");
  if (!footer) return;
  let el = document.getElementById("auth-status");
  if (!el) {
    el = document.createElement("span");
    el.id = "auth-status";
    el.className = "muted";
    footer.prepend(el);
  }
  el.textContent = session ? "Signed in: " + (session.user?.email ?? "") + " \u00b7 " : "";
}

function renderConfigStatus() {
  const el = document.getElementById("config-status");
  if (!el) return;
  el.textContent = isConfigured()
    ? "Live Supabase intelligence \u2014 authenticated access only."
    : "Supabase not configured \u2014 sign-in unavailable.";
}

async function initPage() {
  const page = document.body.dataset.page;
  const modulePath = PAGE_MODULES[page];
  if (!modulePath) return;
  try {
    const mod = await import(modulePath);
    await mod.init();
  } catch (err) {
    console.error("[PRISM] page init failed:", err);
    const main = document.getElementById("main");
    if (main) main.insertAdjacentHTML("afterbegin", errorState("This section failed to load: " + (err?.message ?? "unknown error")));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    initNavigation();
    renderConfigStatus();
  } catch (err) {
    console.error("[PRISM] initialization error:", err);
  }

  const page = document.body.dataset.page;
  const session = await getSession();
  renderAuthStatus(session);

  // Auth gate: everything except the login page requires a session.
  if (page !== "login" && !session) {
    location.replace("login.html");
    return;
  }
  onAuthChange((s) => {
    renderAuthStatus(s);
    if (!s && document.body.dataset.page !== "login") location.replace("login.html");
  });

  initPage();
});

export { config };
