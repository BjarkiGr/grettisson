// PRISM — auth.js
// Supabase Auth integration (Phase 2, single-administrator MVP).
// Email/password sign-in only. Sign-ups are disabled in the Supabase
// dashboard; the single admin account is created there manually.
// Also wires the login page (routed by app.js via data-page="login").

import { getClient } from "./supabase.js";
import { isConfigured } from "./config.js";

/** Current session, or null when unconfigured/signed out. Never throws. */
export async function getSession() {
  if (!isConfigured()) return null;
  try {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    return data.session ?? null;
  } catch (err) {
    console.error("[PRISM] getSession failed:", err);
    return null;
  }
}

/** Signs in with email/password. Throws the provider error on failure. */
export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const sb = await getClient();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

/** Subscribes to auth changes; returns an unsubscribe function. */
export function onAuthChange(callback) {
  if (!isConfigured()) return () => {};
  let subscription = null;
  let cancelled = false;
  getClient().then((sb) => {
    const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
    subscription = data.subscription;
    if (cancelled) subscription.unsubscribe();
  }).catch((err) => console.error("[PRISM] auth subscription failed:", err));
  return () => {
    cancelled = true;
    if (subscription) subscription.unsubscribe();
  };
}

/** Login-page wiring (only runs on login.html). */
export async function init() {
  const form = document.getElementById("login-form");
  if (!form) return;
  const emailEl = document.getElementById("login-email");
  const passwordEl = document.getElementById("login-password");
  const submitEl = document.getElementById("login-submit");
  const errorEl = document.getElementById("login-error");
  const signedOutEl = document.getElementById("auth-signed-out");
  const signedInEl = document.getElementById("auth-signed-in");
  const authEmailEl = document.getElementById("auth-email");
  const noteEl = document.getElementById("auth-config-note");
  const logoutBtn = document.getElementById("logout-btn");

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  const renderState = (session) => {
    const signedIn = Boolean(session);
    signedOutEl.hidden = signedIn;
    signedInEl.hidden = !signedIn;
    if (signedIn) authEmailEl.textContent = session.user?.email ?? "(unknown)";
  };

  if (!isConfigured()) {
    noteEl.textContent = "Supabase is not configured yet. Set supabaseUrl and supabaseAnonKey in js/config.js (see .env.example). Sign-in is disabled until then.";
    submitEl.disabled = true;
    return;
  }
  noteEl.textContent = "Single-administrator access. Account creation is disabled \u2014 the admin account is provisioned in the Supabase dashboard.";

  renderState(await getSession());
  onAuthChange(renderState);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    submitEl.disabled = true;
    submitEl.textContent = "Signing in\u2026";
    try {
      const session = await signIn(emailEl.value.trim(), passwordEl.value);
      renderState(session);
      location.href = "index.html";
      passwordEl.value = "";
    } catch (err) {
      showError(err?.message ?? "Sign-in failed.");
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = "Sign in";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut();
      renderState(null);
    } catch (err) {
      showError(err?.message ?? "Sign-out failed.");
    }
  });
}
