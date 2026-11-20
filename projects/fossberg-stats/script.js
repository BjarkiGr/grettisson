// ============================================================================
// Size It Up — Stigatafla
// Static frontend sem talar við Supabase (sjá README.md fyrir uppsetningu).
// Límdu inn þín gildi hér að neðan: Project Settings → API Keys í Supabase.
// Notaðu PUBLISHABLE-lykilinn (sb_publishable_...) eða eldri anon-lykilinn.
// ALDREI secret-lykilinn (sb_secret_...) — hann má ekki fara í frontend.
// ============================================================================
const SUPABASE_URL = 'https://zseurcwufrhmqvrmanqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ehl5_wRvgnzsG7bZeFVZLA_4yjbJfT0';

// Þolið ef /rest/v1 eða skástrika eru límd með URL-inu — við bætum þeim við sjálf.
const API_BASE = SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

function isConfigured() {
  return !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');
}

// Þunnur API-lagi: kall í Postgres-föll gegnum Supabase REST (PostgREST).
// Kemur í staðinn fyrir ?api=... köllin í PHP-útgáfunni.
async function api(fn, args = {}) {
  if (!isConfigured()) {
    throw new Error('Supabase er ekki uppsett. Fylgdu README.md og uppfærðu efst í script.js.');
  }
  const res = await fetch(`${API_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(args)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.message) || 'Villa kom upp við að tala við þjón.');
  }
  return data;
}

let state = {
  users: [],
  scores: [],
  mode: 'daily',
  authMode: 'login',
  currentUser: JSON.parse(localStorage.getItem('sizeitup_session') || 'null')
};

async function fetchData() {
  if (!isConfigured()) {
    renderAuthHeader();
    document.getElementById('tableContainer').innerHTML = `<div class="empty-state">⚙️ Supabase er ekki uppsett ennþá.<br>Fylgdu skrefunum í <strong>README.md</strong>: keyrðu <strong>supabase-setup.sql</strong> og settu URL + anon-lykil efst í <strong>script.js</strong>.</div>`;
    return;
  }
  try {
    const json = await api('get_data');
    state.users = json.users || [];
    state.scores = json.scores || [];
    populatePuzzleDropdown();
    renderAll();
  } catch (e) {
    console.error('Villa við að sækja gögn:', e);
  }
}

function renderAuthHeader() {
  const area = document.getElementById('authArea');
  if (state.currentUser) {
    area.innerHTML = `
      <div class="user-badge">
        <span class="user-dot"></span>
        <span>${esc(state.currentUser.name)}</span>
        <button style="background:transparent;color:var(--muted);padding:0 0 0 6px;font-size:0.8rem;" onclick="logout()" title="Útskrá">Út</button>
      </div>
    `;
  } else {
    area.innerHTML = `<button class="btn-secondary" onclick="openAuthModal('login')">Innskrá / Nýskrá</button>`;
  }
}

function populatePuzzleDropdown() {
  const select = document.getElementById('puzzleSelect');
  const prev = select.value;
  const puzzles = [...new Set(state.scores.map(s => Number(s.puzzle)))].sort((a, b) => b - a);

  select.innerHTML = '';
  if (puzzles.length === 0) {
    select.innerHTML = `<option value="">Engar þrautir komnar</option>`;
    return;
  }

  puzzles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = `Þraut #${p}`;
    select.appendChild(opt);
  });

  if (prev && puzzles.includes(Number(prev))) {
    select.value = prev;
  }
}

function switchMode(mode) {
  state.mode = mode;
  document.getElementById('tabDaily').classList.toggle('active', mode === 'daily');
  document.getElementById('tabAverage').classList.toggle('active', mode === 'average');
  document.getElementById('puzzleFilterWrap').style.display = mode === 'daily' ? 'block' : 'none';
  renderAll();
}

function getStandings() {
  if (state.mode === 'daily') {
    const puzzle = Number(document.getElementById('puzzleSelect').value);
    if (!puzzle) return [];
    return state.scores
      .filter(s => Number(s.puzzle) === puzzle)
      .sort((a, b) => b.score - a.score)
      .map(s => ({
        name: s.name,
        primaryScore: Number(s.score),
        displayScore: `${s.score}`,
        subLabel: s.timestamp || '',
        grid: s.grid || '',
        games: 1
      }));
  } else {
    const map = {};
    state.scores.forEach(s => {
      const key = s.name.toLowerCase();
      if (!map[key]) {
        map[key] = { name: s.name, total: 0, count: 0, best: 0 };
      }
      map[key].total += Number(s.score);
      map[key].count += 1;
      if (Number(s.score) > map[key].best) map[key].best = Number(s.score);
    });

    return Object.values(map)
      .map(p => {
        const avg = p.total / p.count;
        return {
          name: p.name,
          primaryScore: avg,
          displayScore: avg.toFixed(1),
          subLabel: `${p.count} leik${p.count === 1 ? 'ur' : 'ir'} · Best: ${p.best}`,
          grid: `Meðaltal\n${p.count} leikir`,
          games: p.count,
          best: p.best
        };
      })
      .sort((a, b) => b.primaryScore - a.primaryScore);
  }
}

function renderAll() {
  renderAuthHeader();
  const list = getStandings();
  renderPodium(list);
  renderTable(list);
}

function renderPodium(list) {
  const container = document.getElementById('podiumContainer');
  const heading = document.getElementById('podiumHeading');
  const puzzle = document.getElementById('puzzleSelect').value;

  heading.textContent = state.mode === 'daily'
    ? (puzzle ? `Efstu 3 sætin — Þraut #${puzzle}` : 'Efstu 3 sætin')
    : 'Efstu 3 sætin — Heildarmeðaltal';

  // Podium order: 2nd (left), 1st (center), 3rd (right)
  const order = [
    { rank: 2, item: list[1], medal: '🥈' },
    { rank: 1, item: list[0], medal: '🥇' },
    { rank: 3, item: list[2], medal: '🥉' }
  ];

  container.innerHTML = order.map(slot => {
    if (!slot.item) {
      return `
        <div class="podium-slot slot-${slot.rank}" style="opacity:0.4;">
          <div class="avatar">?</div>
          <div class="podium-name">Laust sæti</div>
          <div class="podium-score">—</div>
          <div class="pedestal">
            <span class="medal">${slot.medal}</span>
          </div>
        </div>
      `;
    }

    const initials = slot.item.name.slice(0, 2).toUpperCase();
    return `
      <div class="podium-slot slot-${slot.rank}" style="cursor:pointer;" onclick="openPlayerHistory('${escAttr(slot.item.name)}')">
        <div class="avatar">${esc(initials)}</div>
        <div class="podium-name">${esc(slot.item.name)}</div>
        <div class="podium-score">${esc(slot.item.displayScore)} <span style="font-size:0.75rem;color:var(--muted);font-weight:600;">/500</span></div>
        <div class="pedestal">
          <span class="medal">${slot.medal}</span>
          <div class="mini-grid">${esc(slot.item.grid)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTable(list) {
  const container = document.getElementById('tableContainer');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">Engin skor skráð ennþá. Smelltu á <strong>+ Skrá skor</strong> til að hefja keppnina!</div>`;
    return;
  }

  const isDaily = state.mode === 'daily';
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th style="width:52px;">Sæti</th>
          <th>Leikmaður</th>
          <th>${isDaily ? 'Stig' : 'Meðaltal'}</th>
          <th class="hide-mobile">${isDaily ? 'Umferðir' : 'Leikir / Best'}</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((row, idx) => {
          const rank = idx + 1;
          const pct = Math.min(100, Math.round((row.primaryScore / 500) * 100));
          const color = row.primaryScore >= 400 ? '#4ade80' : row.primaryScore >= 250 ? '#fbbf24' : '#f87171';
          return `
            <tr onclick="openPlayerHistory('${escAttr(row.name)}')">
              <td><span class="rank-badge rank-${rank <= 3 ? rank : ''}">${rank}</span></td>
              <td>
                <div style="font-weight:700;">${esc(row.name)}</div>
                <div style="font-size:0.76rem;color:var(--muted);">${esc(row.subLabel)}</div>
              </td>
              <td>
                <div style="font-weight:800;font-size:1.05rem;">${esc(row.displayScore)} <span style="font-size:0.78rem;color:var(--muted);font-weight:500;">/ 500</span></div>
                <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>
              </td>
              <td class="hide-mobile">
                ${isDaily
                  ? `<div class="grid-inline">${esc(row.grid)}</div>`
                  : `<span style="font-size:0.85rem;color:var(--muted);">${esc(row.subLabel)}</span>`
                }
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// Auth Logic
function openAuthModal(tab = 'login') {
  setAuthTab(tab);
  document.getElementById('authMsg').textContent = '';
  document.getElementById('authPin').value = '';
  document.getElementById('authModal').classList.add('open');
  document.getElementById('authName').focus();
}

function setAuthTab(tab) {
  state.authMode = tab;
  document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('authModalTitle').textContent = tab === 'login' ? 'Innskráning' : 'Búa til aðgang';
  document.getElementById('authSubmitBtn').textContent = tab === 'login' ? 'Skrá inn' : 'Stofna aðgang';
  document.getElementById('authMsg').textContent = '';
}

async function handleAuth() {
  const name = document.getElementById('authName').value.trim();
  const pin = document.getElementById('authPin').value.trim();
  const msg = document.getElementById('authMsg');

  if (!name || !/^\d{4}$/.test(pin)) {
    msg.className = 'msg err';
    msg.textContent = 'Sláðu inn nafn og nákvæmlega 4 tölustafa PIN.';
    return;
  }

  try {
    const fn = state.authMode === 'login' ? 'login_player' : 'register_player';
    const data = await api(fn, { p_name: name, p_pin: pin });
    state.currentUser = { name: data.name, pin };
    localStorage.setItem('sizeitup_session', JSON.stringify(state.currentUser));
    closeModals();
    await fetchData();
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message || 'Villa kom upp.';
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('sizeitup_session');
  renderAuthHeader();
}

// Score Parsing & Submission
function parseShareText(raw) {
  const puzzleMatch = raw.match(/#(\d+)/);
  const scoreMatch = raw.match(/Score:\s*(\d+)\s*\/\s*500/i);
  if (!puzzleMatch || !scoreMatch) return null;

  const puzzle = parseInt(puzzleMatch[1], 10);
  const score = parseInt(scoreMatch[1], 10);
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const roundLines = lines.filter(l => /[⬜🟥🟩🟨⬛]/.test(l));
  const rounds = roundLines.map(l => {
    const m = l.match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : null;
  }).filter(n => n !== null);

  return { puzzle, score, rounds, grid: roundLines.join('\n') };
}

function openSubmitModal() {
  if (!state.currentUser) {
    openAuthModal('login');
    document.getElementById('authMsg').className = 'msg';
    document.getElementById('authMsg').textContent = 'Skráðu þig inn (eða stofnaðu aðgang) til að vista skor.';
    return;
  }
  document.getElementById('shareInput').value = '';
  document.getElementById('submitMsg').textContent = '';
  document.getElementById('parsePreview').textContent = 'Límdu textann hér að ofan til að forskoða stigin.';
  document.getElementById('submitModal').classList.add('open');
  document.getElementById('shareInput').focus();
}

function updateParsePreview() {
  const parsed = parseShareText(document.getElementById('shareInput').value);
  const box = document.getElementById('parsePreview');
  if (!parsed) {
    box.innerHTML = 'Bíð eftir gildum Size It Up texta (t.d. <code>#103</code> og <code>Score: 314/500</code>)...';
    return;
  }
  box.innerHTML = `✅ Greint: <strong>Þraut #${parsed.puzzle}</strong> · <strong>${parsed.score} / 500 stig</strong> (${parsed.rounds.length} umferðir)`;
}

async function submitScore() {
  if (!state.currentUser) return openAuthModal('login');
  const parsed = parseShareText(document.getElementById('shareInput').value);
  const msg = document.getElementById('submitMsg');

  if (!parsed) {
    msg.className = 'msg err';
    msg.textContent = 'Gat ekki lesið þrautarnúmer eða stig. Afritaðu allan Share-textann úr leiknum.';
    return;
  }

  try {
    await api('submit_score', {
      p_name: state.currentUser.name,
      p_pin: state.currentUser.pin,
      p_puzzle: parsed.puzzle,
      p_score: parsed.score,
      p_grid: parsed.grid,
      p_rounds: parsed.rounds
    });
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message || 'Tókst ekki að vista skor.';
    return;
  }

  await fetchData();
  state.mode = 'daily';
  switchMode('daily');
  document.getElementById('puzzleSelect').value = parsed.puzzle;
  renderAll();
  closeModals();
}

// Player History Modal
function openPlayerHistory(playerName) {
  const entries = state.scores
    .filter(s => s.name.toLowerCase() === playerName.toLowerCase())
    .sort((a, b) => b.puzzle - a.puzzle);

  document.getElementById('playerModalTitle').textContent = `${playerName} — Saga`;
  const body = document.getElementById('playerHistoryBody');

  if (entries.length === 0) {
    body.innerHTML = `<div class="empty-state">Engir leikir skráðir.</div>`;
  } else {
    const avg = (entries.reduce((acc, s) => acc + Number(s.score), 0) / entries.length).toFixed(1);
    const best = Math.max(...entries.map(s => Number(s.score)));
    body.innerHTML = `
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <div style="flex:1;background:var(--bg);padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:0.75rem;color:var(--muted);">MEÐALTAL</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--gold);">${avg}</div>
        </div>
        <div style="flex:1;background:var(--bg);padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:0.75rem;color:var(--muted);">BESTA SKOR</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--green);">${best}</div>
        </div>
        <div style="flex:1;background:var(--bg);padding:12px;border-radius:10px;text-align:center;">
          <div style="font-size:0.75rem;color:var(--muted);">LEIKIR</div>
          <div style="font-size:1.3rem;font-weight:800;">${entries.length}</div>
        </div>
      </div>
      <div style="max-height:280px;overflow-y:auto;">
        <table>
          <thead><tr><th>Þraut</th><th>Stig</th><th>Umferðir</th></tr></thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td><strong>#${e.puzzle}</strong></td>
                <td><strong>${e.score}</strong> / 500</td>
                <td><div class="grid-inline">${esc(e.grid)}</div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  document.getElementById('playerModal').classList.add('open');
}

function closeModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
function escAttr(str) {
  return String(str ?? '').replace(/'/g, "\\'");
}

// Uppfæra sjálfkrafa á 30 sekúndna fresti svo ný skor birtist hjá öllum
fetchData();
setInterval(fetchData, 30000);
