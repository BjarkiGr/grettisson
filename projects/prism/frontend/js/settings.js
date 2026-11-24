// PRISM — settings.js
// Phase 2: real connection diagnostics against Supabase (read tests under
// RLS). Preferences UI arrives in Phase 6. Added file: justified like
// components.js — the spec requires settings behavior but names no module.

import { isConfigured } from "./config.js";
import { getClient } from "./supabase.js";
import { getSession, signOut } from "./auth.js";
import { escapeHtml, formatDate } from "./utils.js";
import { loadingState, errorState } from "./components.js";

const READ_TABLES = ["sources", "articles", "events", "analyses", "risk_scores", "watchlists"];

export async function init() {
  const root = document.getElementById("connection-root");
  if (!root) return;

  if (!isConfigured()) {
    root.innerHTML = errorState("Supabase is not configured. Set supabaseUrl and supabaseAnonKey in js/config.js, then reload.");
    return;
  }

  const session = await getSession();
  root.innerHTML =
    '<p>Configuration: <strong>present</strong></p>' +
    '<p>Session: ' + (session ? '<strong>' + escapeHtml(session.user?.email ?? "signed in") + '</strong>' : '<strong>not signed in</strong>') + "</p>" +
    '<div class="filter-bar">' +
      '<button id="run-read-tests" class="nav-toggle" style="display:inline-block">Run read tests</button>' +
      (session ? '<button id="settings-logout" class="nav-toggle" style="display:inline-block">Sign out</button>' : '<a href="login.html">Sign in</a>') +
    "</div>" +
    '<div id="read-test-results">' +
    '<p class="muted">Read tests query each table with your current credentials. Signed out, reads are denied (anon has no table privileges). Signed in as the admin, reads succeed. Empty tables are expected until Phase 3.</p>' +
    "</div>";

  const results = root.querySelector("#read-test-results");
  root.querySelector("#run-read-tests").addEventListener("click", async () => {
    results.innerHTML = loadingState("Testing reads\u2026");
    try {
      const sb = await getClient();
      const rows = [];
      for (const table of READ_TABLES) {
        const { count, error } = await sb.from(table).select("id", { count: "exact", head: true });
        rows.push(error
          ? '<tr><td>' + escapeHtml(table) + '</td><td class="state error">' + escapeHtml(error.message) + "</td></tr>"
          : '<tr><td>' + escapeHtml(table) + "</td><td>OK \u2014 " + escapeHtml(count) + " visible row(s)</td></tr>");
      }
      results.innerHTML = '<table class="data-table"><thead><tr><th>Table</th><th>Result</th></tr></thead><tbody>' + rows.join("") + "</tbody></table>";
    } catch (err) {
      results.innerHTML = errorState(err?.message ?? "Read tests failed.");
    }
  });

  const logout = root.querySelector("#settings-logout");
  if (logout) {
    logout.addEventListener("click", async () => {
      try { await signOut(); location.reload(); }
      catch (err) { results.innerHTML = errorState(err?.message ?? "Sign-out failed."); }
    });
  }
  await initUserManagement();
}


/** Admin-only user management via the manage-users Edge Function. */
async function initUserManagement() {
  const section = document.getElementById("users-section");
  const root = document.getElementById("users-root");
  if (!section || !root) return;
  const session = await getSession();
  if (!session) return;
  const sb = await getClient();
  const { data: profile, error: profErr } = await sb.from("profiles").select("role").eq("id", session.user.id).single();
  if (profErr) {
    section.hidden = false;
    root.innerHTML = errorState("User roles are not initialized yet. Apply migration 20261128000000_user_roles.sql in the Supabase SQL Editor, then reload this page.");
    return;
  }
  if (profile?.role !== "admin") return; // viewers never see this panel
  section.hidden = false;

  const call = async (body) => {
    const { data, error } = await sb.functions.invoke("manage-users", { body });
    if (error) {
      let msg = error.message;
      try {
        if (error.context && typeof error.context.json === "function") {
          const j = await error.context.json();
          msg = j.error ?? msg;
        }
      } catch { /* keep original message */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const render = async () => {
    root.innerHTML = loadingState("Loading users\u2026");
    try {
      const { users } = await call({ action: "list" });
      root.innerHTML =
        '<div class="filter-bar">' +
          '<label class="filter-field"><span class="muted">Email</span><input id="nu-email" type="email" placeholder="viewer@example.com" autocomplete="off"></label>' +
          '<label class="filter-field"><span class="muted">Password (min 8 chars)</span><input id="nu-password" type="password" autocomplete="new-password"></label>' +
          '<button id="nu-add" class="nav-toggle" style="display:inline-block">Add viewer</button>' +
        "</div>" +
        '<p id="nu-status" class="muted" role="status"></p>' +
        '<table class="data-table"><thead><tr><th>Email</th><th>Role</th><th>Created</th><th>Last sign-in</th><th></th></tr></thead><tbody>' +
        users.map((u) =>
          '<tr><td>' + escapeHtml(u.email) + (u.is_self ? " (you)" : "") + "</td><td>" + escapeHtml(u.role) + "</td><td>" + formatDate(u.created_at) + "</td><td>" + formatDate(u.last_sign_in_at) + "</td><td>" +
          (u.is_self || u.role === "admin" ? "" : '<button class="nav-toggle u-del" data-id="' + escapeHtml(u.id) + '" style="display:inline-block">Remove</button>') +
          "</td></tr>").join("") +
        "</tbody></table>" +
        '<p class="muted">New users are viewers: they can read intelligence and manage their own watchlists, but cannot add or remove users. Share the password with them securely; they sign in on the login page.</p>';
      const status = root.querySelector("#nu-status");
      root.querySelector("#nu-add").addEventListener("click", async () => {
        const email = root.querySelector("#nu-email").value.trim();
        const password = root.querySelector("#nu-password").value;
        status.textContent = "Creating\u2026";
        try { await call({ action: "create", email, password }); await render(); }
        catch (e) { status.textContent = "Error: " + e.message; }
      });
      for (const btn of root.querySelectorAll(".u-del")) {
        btn.addEventListener("click", async () => {
          status.textContent = "Removing\u2026";
          try { await call({ action: "delete", user_id: btn.dataset.id }); await render(); }
          catch (e) { status.textContent = "Error: " + e.message; }
        });
      }
    } catch (e) {
      root.innerHTML = errorState("User management unavailable: " + e.message);
    }
  };
  await render();
}