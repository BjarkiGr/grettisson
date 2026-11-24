// ============================================================================
// Daily Games Stats — Stigatafla fyrir Size It Up, Skuggabaldur, Krillion og Verðlengjan
// Static frontend sem talar við Supabase (sjá README.md fyrir uppsetningu).
// Límdu inn þín gildi hér að neðan: Project Settings → API Keys í Supabase.
// Notaðu PUBLISHABLE-lykilinn (sb_publishable_...) eða eldri anon-lykilinn.
// ALDREI secret-lykilinn (sb_secret_...) — hann má ekki fara í frontend.
// ============================================================================
const SUPABASE_URL = 'https://zseurcwufrhmqvrmanqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ehl5_wRvgnzsG7bZeFVZLA_4yjbJfT0';

// Þolið ef /rest/v1 eða skástrika eru límd með URL-inu — við bætum þeim við sjálf.
const API_BASE = SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

// Leikirnir. max: null = ekkert fast hámark (enginn leikur eins og er).
// Verðlengjan: 102 cm hámark + 5 cm fimmtudagsbonus (gagnagrunnur leyfir 107).
const GAMES = {
  sizeitup:     { label: 'Size It Up',   icon: '📏', max: 500,  url: 'https://magnitudle.com/size-it-up' },
  skuggabaldur: { label: 'Skuggabaldur', icon: '🌑', max: 700,  url: 'https://skuggabaldur.is' },
  krillion:     { label: 'Krillion',     icon: '🦐', max: 700,  url: 'https://krillion.io' },
  verdlengjan:  { label: 'Verðlengjan',  icon: '🥐', max: 102, unit: ' cm', url: 'https://grettisson.is/projects/verdlengjan/' }
};

function isConfigured() {
  return !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');
}

// Þunnur API-lagi: kall í Postgres-föll gegnum Supabase REST (PostgREST).
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
  traffic: null,
  mode: 'daily',
  authMode: 'login',
  game: 'sizeitup',
  currentUser: JSON.parse(localStorage.getItem('sizeitup_session') || 'null')
};

function gameMax() {
  return GAMES[state.game].max;
}

function isAdmin() {
  return !!(state.currentUser && state.currentUser.isAdmin);
}

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
    // Heildarumferð Verðlengjan (nafnlaus talning í leiknum). Ef migration
    // hefur ekki verið keyrt ennþá fellur spjaldið til baka á skráð skor.
    try { state.traffic = await api('verd_traffic'); } catch (e) { state.traffic = null; }
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
        <span>${isAdmin() ? '👑 ' : ''}${esc(state.currentUser.name)}</span>
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
  const puzzles = [...new Set(
    state.scores
      .filter(s => (s.game || 'sizeitup') === state.game)
      .map(s => Number(s.puzzle))
  )].sort((a, b) => b - a);

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

function switchGame(game) {
  state.game = game;
  Object.keys(GAMES).forEach(g => {
    document.getElementById('gameTab-' + g).classList.toggle('active', g === game);
  });
  document.getElementById('playLink').href = GAMES[game].url;
  populatePuzzleDropdown();
  renderAll();
}

function switchMode(mode) {
  state.mode = mode;
  document.getElementById('tabDaily').classList.toggle('active', mode === 'daily');
  document.getElementById('tabAverage').classList.toggle('active', mode === 'average');
  document.getElementById('puzzleFilterWrap').style.display = mode === 'daily' ? 'block' : 'none';
  renderAll();
}

function getStandings() {
  const gameScores = state.scores.filter(s => (s.game || 'sizeitup') === state.game);

  if (state.mode === 'daily') {
    const puzzle = Number(document.getElementById('puzzleSelect').value);
    if (!puzzle) return [];
    return gameScores
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
    gameScores.forEach(s => {
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
  renderParticipation();
}

// Verðlengjan þraut #1 var 18.11.2026 (sama EPOCH og í leiknum sjálfum).
const VERD_EPOCH = Date.UTC(2026, 10, 18);
function verdPuzzleDate(puzzle) {
  const d = new Date(VERD_EPOCH + (puzzle - 1) * 86400000);
  return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.';
}

// Þátttaka í Verðlengjunni: HEILDARUMFERÐ — hversu margir heimsóttu leikinn
// og kláruðu daglega þraut á hverjum degi (nafnlaus talning í leiknum sjálfum,
// verd_traffic). Sýnist aðeins innskráðum notendum á Verðlengjan-flipanum.
// Ef traffic-migration hefur ekki verið keyrt: fallback á skráð skor.
function renderParticipation() {
  const card = document.getElementById('participationCard');
  const show = state.game === 'verdlengjan' && !!state.currentUser;
  card.style.display = show ? 'block' : 'none';
  if (!show) return;
  const body = document.getElementById('participationBody');

  const days = Array.isArray(state.traffic) ? state.traffic : [];
  if (days.length) {
    const max = Math.max(...days.map(d => Number(d.visits) || 0), 1);
    const totalV = days.reduce((s, d) => s + (Number(d.visits) || 0), 0);
    const totalC = days.reduce((s, d) => s + (Number(d.completes) || 0), 0);
    body.innerHTML = `
      <div class="participation-summary">${days.length} ${days.length === 1 ? 'dagur' : 'dagar'} · ${totalV} heimsóknir · ${totalC} kláruðu</div>
      ${days.map(d => {
        const v = Number(d.visits) || 0, c = Number(d.completes) || 0;
        return `
        <div class="participation-row">
          <span class="p-day">#${d.puzzle} · ${verdPuzzleDate(Number(d.puzzle))}</span>
          <div class="p-bar"><div class="p-bar-fill" style="width:${Math.max(4, Math.round(v / max * 100))}%"></div></div>
          <span class="p-count">${v} ${v === 1 ? 'heimsókn' : 'heimsóknir'} · ${c} kláruðu</span>
        </div>`;
      }).join('')}
    `;
    return;
  }

  // Fallback: skráð skor á stigatöfluna (þar til traffic-migration er keyrt).
  const counts = {};
  state.scores
    .filter(s => (s.game || 'sizeitup') === 'verdlengjan')
    .forEach(s => { const p = Number(s.puzzle); counts[p] = (counts[p] || 0) + 1; });
  const puzzles = Object.keys(counts).map(Number).sort((a, b) => b - a);
  if (!puzzles.length) {
    body.innerHTML = '<div class="empty-state">Engin Verðlengjan-gögn ennþá.</div>';
    return;
  }
  const max = Math.max(...puzzles.map(p => counts[p]));
  const total = puzzles.reduce((s, p) => s + counts[p], 0);
  body.innerHTML = `
    <div class="participation-summary">${puzzles.length} ${puzzles.length === 1 ? 'dagur' : 'dagar'} · ${total} skráð skor — heildarumferð birtist þegar traffic-migration er keyrt</div>
    ${puzzles.map(p => `
      <div class="participation-row">
        <span class="p-day">#${p} · ${verdPuzzleDate(p)}</span>
        <div class="p-bar"><div class="p-bar-fill" style="width:${Math.max(4, Math.round(counts[p] / max * 100))}%"></div></div>
        <span class="p-count">${counts[p]} ${counts[p] === 1 ? 'leikmaður' : 'leikmenn'}</span>
      </div>
    `).join('')}
  `;
}


function renderPodium(list) {
  const container = document.getElementById('podiumContainer');
  const heading = document.getElementById('podiumHeading');
  const puzzle = document.getElementById('puzzleSelect').value;
  const max = gameMax();

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
        <div class="podium-score">${esc(slot.item.displayScore)} <span style="font-size:0.75rem;color:var(--muted);font-weight:600;">${max ? '/' + max : ''}${GAMES[state.game].unit || ''}</span></div>
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
  const max = gameMax();
  // Ef leikur hefur ekkert fast hámark miðum við efsta skor í staðinn.
  const scale = max || (list.length ? list[0].primaryScore : 0) || 1;
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
          const ratio = row.primaryScore / scale;
          const pct = Math.min(100, Math.round(ratio * 100));
          const color = ratio >= 0.8 ? '#4ade80' : ratio >= 0.5 ? '#fbbf24' : '#f87171';
          return `
            <tr onclick="openPlayerHistory('${escAttr(row.name)}')">
              <td><span class="rank-badge rank-${rank <= 3 ? rank : ''}">${rank}</span></td>
              <td>
                <div style="font-weight:700;">${esc(row.name)}</div>
                <div style="font-size:0.76rem;color:var(--muted);">${esc(row.subLabel)}</div>
              </td>
              <td>
                <div style="font-weight:800;font-size:1.05rem;">${esc(row.displayScore)} <span style="font-size:0.78rem;color:var(--muted);font-weight:500;">${max ? '/ ' + max : ''}${GAMES[state.game].unit || ''}</span></div>
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
    state.currentUser = { name: data.name, pin, isAdmin: !!data.isAdmin };
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
  renderParticipation(); // felur þátttökuspjaldið við útskráningu
}

// Score Parsing — leikurinn greinist sjálfkrafa úr Share-textanum
function parseShareText(raw) {
  if (/skuggabaldur/i.test(raw)) return parseSkuggabaldur(raw);
  if (/krillion/i.test(raw)) return parseKrillion(raw);
  if (/verðlengjan/i.test(raw)) return parseVerdlengjan(raw);
  return parseSizeItUp(raw);
}

function parseSizeItUp(raw) {
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

  return { game: 'sizeitup', puzzle, score, rounds, grid: roundLines.join('\n') };
}

// Emoji-línur án hauslínu og tengla (fyrir Skuggabaldur og Krillion)
function emojiGridLines(raw, gameName) {
  return raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    .filter(l => /\p{Extended_Pictographic}/u.test(l))
    .filter(l => !new RegExp(gameName, 'i').test(l))
    .filter(l => !/^https?:\/\//i.test(l));
}

function parseSkuggabaldur(raw) {
  const m = raw.match(/Skuggabaldur\s*#(\d+)[^\n]*?(\d+)\s*\/\s*700/i);
  if (!m) return null;
  return {
    game: 'skuggabaldur',
    puzzle: parseInt(m[1], 10),
    score: parseInt(m[2], 10),
    rounds: [],
    grid: emojiGridLines(raw, 'skuggabaldur').join('\n')
  };
}

function parseKrillion(raw) {
  const m = raw.match(/Krillion\s*#(\d+)/i);
  if (!m) return null;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const scoreLine = lines.find(l => /^\d+$/.test(l));
  if (!scoreLine) return null;
  return {
    game: 'krillion',
    puzzle: parseInt(m[1], 10),
    score: parseInt(scoreLine, 10),
    rounds: [],
    grid: emojiGridLines(raw, 'krillion').join('\n')
  };
}

function parseVerdlengjan(raw) {
  const m = raw.match(/Verðlengjan\s*#(\d+)\s*[—–-]\s*(\d+)\s*cm/i);
  if (!m) return null;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const roundLines = lines.filter(l => /[🎯🟩🟨🟧🟥⬛]/.test(l));
  return {
    game: 'verdlengjan',
    puzzle: parseInt(m[1], 10),
    score: parseInt(m[2], 10),
    rounds: [],
    grid: roundLines.join('\n')
  };
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
    box.innerHTML = 'Bíð eftir gildum Share-texta frá Size It Up, Skuggabaldur, Krillion eða Verðlengjan...';
    return;
  }
  const g = GAMES[parsed.game];
  const roundsInfo = parsed.rounds.length ? ` (${parsed.rounds.length} umferðir)` : '';
  box.innerHTML = `✅ Greint: ${g.icon} <strong>${g.label} #${parsed.puzzle}</strong> · <strong>${parsed.score}${g.max ? ' / ' + g.max : ''}${g.unit || ' stig'}</strong>${roundsInfo}`;
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
      p_game: parsed.game,
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
  switchGame(parsed.game);
  switchMode('daily');
  document.getElementById('puzzleSelect').value = parsed.puzzle;
  renderAll();
  closeModals();
}

// Player History Modal (fyrir valinn leik)
function openPlayerHistory(playerName) {
  const entries = state.scores
    .filter(s => (s.game || 'sizeitup') === state.game)
    .filter(s => s.name.toLowerCase() === playerName.toLowerCase())
    .sort((a, b) => b.puzzle - a.puzzle);

  const g = GAMES[state.game];
  document.getElementById('playerModalTitle').textContent = `${playerName} — ${g.icon} ${g.label}`;
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
      ${isAdmin() ? `
      <div class="admin-actions">
        <button class="btn-secondary" onclick="adminResetPin('${escAttr(playerName)}')">🔑 Endurstilla PIN</button>
        <button class="btn-secondary admin-danger" onclick="adminDeletePlayer('${escAttr(playerName)}')">🗑 Eyða leikmanni</button>
      </div>` : ''}
      <div style="max-height:280px;overflow-y:auto;">
        <table>
          <thead><tr><th>Þraut</th><th>Stig</th><th>Umferðir</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td><strong>#${e.puzzle}</strong></td>
                <td><strong>${e.score}</strong>${g.max ? ' / ' + g.max : ''}${g.unit || ''}</td>
                <td><div class="grid-inline">${esc(e.grid)}</div></td>
                ${isAdmin() ? `<td><button class="admin-del" onclick="adminDeleteScore('${escAttr(e.name)}', '${e.game || 'sizeitup'}', ${e.puzzle})" title="Eyða þessu skori">🗑</button></td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  document.getElementById('playerModal').classList.add('open');
}

// Admin controls — þjónninn staðfestir PIN + is_admin við hvert kall
async function adminDeleteScore(target, game, puzzle) {
  if (!isAdmin()) return;
  if (!confirm(`Eyða skori: ${target} — ${GAMES[game].label} #${puzzle}?`)) return;
  try {
    await api('admin_delete_score', {
      p_name: state.currentUser.name,
      p_pin: state.currentUser.pin,
      p_target: target,
      p_game: game,
      p_puzzle: puzzle
    });
    closeModals();
    await fetchData();
  } catch (e) {
    alert(e.message || 'Villa kom upp.');
  }
}

async function adminDeletePlayer(target) {
  if (!isAdmin()) return;
  if (!confirm(`Eyða leikmanninum ${target} og ÖLLUM skorunum hans? Þetta er ekki afturkræft.`)) return;
  try {
    await api('admin_delete_player', {
      p_name: state.currentUser.name,
      p_pin: state.currentUser.pin,
      p_target: target
    });
    closeModals();
    await fetchData();
  } catch (e) {
    alert(e.message || 'Villa kom upp.');
  }
}

async function adminResetPin(target) {
  if (!isAdmin()) return;
  const newPin = prompt(`Nýtt 4 stafa PIN fyrir ${target}:`);
  if (newPin === null) return;
  if (!/^\d{4}$/.test(newPin.trim())) {
    alert('PIN verður að vera nákvæmlega 4 tölustafir.');
    return;
  }
  try {
    await api('admin_reset_pin', {
      p_name: state.currentUser.name,
      p_pin: state.currentUser.pin,
      p_target: target,
      p_new_pin: newPin.trim()
    });
    alert(`PIN fyrir ${target} endurstillt.`);
  } catch (e) {
    alert(e.message || 'Villa kom upp.');
  }
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
async function init() {
  // Við ræsingu er setan endurstaðfest (PIN + isAdmin) gegnum login_player.
  if (state.currentUser && isConfigured()) {
    try {
      const data = await api('login_player', { p_name: state.currentUser.name, p_pin: state.currentUser.pin });
      state.currentUser = { name: data.name, pin: state.currentUser.pin, isAdmin: !!data.isAdmin };
      localStorage.setItem('sizeitup_session', JSON.stringify(state.currentUser));
    } catch (e) {
      state.currentUser = null;
      localStorage.removeItem('sizeitup_session');
    }
  }
  await fetchData();
  setInterval(fetchData, 30000);
}
init();
