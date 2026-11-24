// PRISM — settings.js
// Phase 2: real connection diagnostics against Supabase (read tests under
// RLS). Preferences UI arrives in Phase 6. Added file: justified like
// components.js — the spec requires settings behavior but names no module.

import { isConfigured } from "./config.js";
import { getClient } from "./supabase.js";
import { getSession, signOut } from "./auth.js";
import { escapeHtml } from "./utils.js";
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
}
