<?php
// ============================================================================
// BAKENDI (PHP API) - Sér um notendur, 4 stafa PIN og vistun í data.json
// ============================================================================
if (isset($_GET['api'])) {
    header('Content-Type: application/json; charset=utf-8');
    $dataFile = __DIR__ . '/data.json';

    if (!file_exists($dataFile)) {
        file_put_contents($dataFile, json_encode([
            'users' => [],
            'scores' => []
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    $fp = fopen($dataFile, 'c+');
    if (!$fp) {
        http_response_code(500);
        echo json_encode(['error' => 'Gat ekki opnað gagnaskrá á þjóni']);
        exit;
    }

    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = ['users' => [], 'scores' => []];
    }

    $action = $_GET['api'];

    // Sækja stöðu og notendur (án PIN-númera)
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'data') {
        $safeUsers = array_map(fn($u) => ['name' => $u['name']], $data['users']);
        echo json_encode([
            'users' => $safeUsers,
            'scores' => $data['scores']
        ], JSON_UNESCAPED_UNICODE);
        flock($fp, LOCK_UN);
        fclose($fp);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        // Nýskráning með 4 stafa PIN
        if ($action === 'register') {
            $name = trim($input['name'] ?? '');
            $pin = trim($input['pin'] ?? '');

            if ($name === '' || mb_strlen($name) > 25 || !preg_match('/^\d{4}$/', $pin)) {
                http_response_code(400);
                echo json_encode(['error' => 'Sláðu inn nafn (hámark 25 stafir) og 4 tölustafa PIN.']);
                flock($fp, LOCK_UN);
                fclose($fp);
                exit;
            }

            foreach ($data['users'] as $u) {
                if (mb_strtolower($u['name']) === mb_strtolower($name)) {
                    http_response_code(409);
                    echo json_encode(['error' => 'Þetta nafn er þegar frátekið.']);
                    flock($fp, LOCK_UN);
                    fclose($fp);
                    exit;
                }
            }

            $data['users'][] = [
                'name' => $name,
                'pinHash' => password_hash($pin, PASSWORD_DEFAULT)
            ];

            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['status' => 'ok', 'name' => $name]);
        }

        // Innskráning
        elseif ($action === 'login') {
            $name = trim($input['name'] ?? '');
            $pin = trim($input['pin'] ?? '');

            foreach ($data['users'] as $u) {
                if (mb_strtolower($u['name']) === mb_strtolower($name) && password_verify($pin, $u['pinHash'])) {
                    echo json_encode(['status' => 'ok', 'name' => $u['name']]);
                    flock($fp, LOCK_UN);
                    fclose($fp);
                    exit;
                }
            }

            http_response_code(401);
            echo json_encode(['error' => 'Rangt nafn eða PIN-númer.']);
        }

        // Skrá eða uppfæra skor
        elseif ($action === 'score') {
            $name = trim($input['name'] ?? '');
            $pin = trim($input['pin'] ?? '');
            $puzzle = intval($input['puzzle'] ?? 0);
            $score = intval($input['score'] ?? -1);
            $grid = $input['grid'] ?? '';
            $rounds = $input['rounds'] ?? [];

            $validUser = null;
            foreach ($data['users'] as $u) {
                if (mb_strtolower($u['name']) === mb_strtolower($name) && password_verify($pin, $u['pinHash'])) {
                    $validUser = $u['name'];
                    break;
                }
            }

            if (!$validUser) {
                http_response_code(401);
                echo json_encode(['error' => 'Innskráning rann út. Skráðu þig inn aftur.']);
                flock($fp, LOCK_UN);
                fclose($fp);
                exit;
            }

            if ($puzzle <= 0 || $score < 0 || $score > 500) {
                http_response_code(400);
                echo json_encode(['error' => 'Ógilt þrautarnúmer eða stigafjöldi.']);
                flock($fp, LOCK_UN);
                fclose($fp);
                exit;
            }

            // Uppfæra ef notandi hefur þegar skráð fyrir þessa þraut
            $data['scores'] = array_values(array_filter($data['scores'], function($s) use ($validUser, $puzzle) {
                return !(mb_strtolower($s['name']) === mb_strtolower($validUser) && intval($s['puzzle']) === $puzzle);
            }));

            $data['scores'][] = [
                'name' => $validUser,
                'puzzle' => $puzzle,
                'score' => $score,
                'rounds' => $rounds,
                'grid' => $grid,
                'timestamp' => date('Y-m-d H:i')
            ];

            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['status' => 'ok']);
        }

        flock($fp, LOCK_UN);
        fclose($fp);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Size It Up — Stigatafla</title>
  <style>
    :root {
      --bg: #0b1120;
      --surface: #131c31;
      --surface-2: #1c2742;
      --border: #2a395c;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #ef4444;
      --accent-hover: #dc2626;
      --gold: #fbbf24;
      --gold-bg: rgba(251, 191, 36, 0.14);
      --silver: #cbd5e1;
      --silver-bg: rgba(203, 213, 225, 0.12);
      --bronze: #f59e0b;
      --bronze-bg: rgba(245, 158, 11, 0.12);
      --green: #4ade80;
    }

    * { box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }

    body {
      margin: 0;
      background: radial-gradient(circle at top, #17233f 0%, var(--bg) 55%);
      color: var(--text);
      min-height: 100vh;
      padding: 20px 16px 60px;
    }

    .app {
      max-width: 860px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Top Bar */
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: rgba(19, 28, 49, 0.85);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      padding: 14px 20px;
      border-radius: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      display: grid;
      place-items: center;
      font-size: 1.3rem;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
    }

    .brand h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.4px;
    }

    .brand span {
      font-size: 0.8rem;
      color: var(--muted);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    button, a.btn {
      border: none;
      border-radius: 10px;
      padding: 9px 15px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
    .btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }

    .btn-secondary {
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { border-color: var(--muted); }

    .user-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .user-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
    }

    /* Controls & Filter Bar */
    .controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .tabs {
      display: inline-flex;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 4px;
      border-radius: 12px;
      gap: 4px;
    }

    .tab {
      background: transparent;
      color: var(--muted);
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
    }

    .tab.active {
      background: var(--surface-2);
      color: var(--text);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    select {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 9px 14px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }

    /* Podium Section */
    .podium-wrapper {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px 16px 0;
      overflow: hidden;
      position: relative;
    }

    .podium-title {
      text-align: center;
      margin: 0 0 22px;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--muted);
      font-weight: 700;
    }

    .podium {
      display: grid;
      grid-template-columns: 1fr 1.12fr 1fr;
      align-items: end;
      gap: 12px;
      max-width: 680px;
      margin: 0 auto;
    }

    .podium-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1.15rem;
      margin-bottom: 8px;
      background: var(--surface-2);
      border: 2px solid var(--border);
    }

    .slot-1 .avatar {
      width: 64px;
      height: 64px;
      font-size: 1.35rem;
      border-color: var(--gold);
      background: var(--gold-bg);
      color: var(--gold);
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.25);
    }
    .slot-2 .avatar { border-color: var(--silver); background: var(--silver-bg); color: var(--silver); }
    .slot-3 .avatar { border-color: var(--bronze); background: var(--bronze-bg); color: var(--bronze); }

    .podium-name {
      font-weight: 700;
      font-size: 0.98rem;
      margin-bottom: 2px;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .podium-score {
      font-weight: 800;
      font-size: 1.15rem;
      margin-bottom: 10px;
    }
    .slot-1 .podium-score { color: var(--gold); font-size: 1.35rem; }
    .slot-2 .podium-score { color: var(--silver); }
    .slot-3 .podium-score { color: var(--bronze); }

    .pedestal {
      width: 100%;
      border-radius: 14px 14px 0 0;
      padding: 14px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      border: 1px solid var(--border);
      border-bottom: none;
    }

    .slot-1 .pedestal {
      height: 155px;
      background: linear-gradient(180deg, rgba(251, 191, 36, 0.22) 0%, rgba(251, 191, 36, 0.04) 100%);
      border-color: rgba(251, 191, 36, 0.45);
    }
    .slot-2 .pedestal {
      height: 125px;
      background: linear-gradient(180deg, rgba(203, 213, 225, 0.16) 0%, rgba(203, 213, 225, 0.03) 100%);
      border-color: rgba(203, 213, 225, 0.35);
    }
    .slot-3 .pedestal {
      height: 105px;
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0.03) 100%);
      border-color: rgba(245, 158, 11, 0.35);
    }

    .medal { font-size: 1.4rem; }

    .mini-grid {
      font-family: monospace;
      font-size: 0.65rem;
      line-height: 1.15;
      opacity: 0.9;
      white-space: pre;
    }

    /* Table Card */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
    }

    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 13px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    tr:last-child td { border-bottom: none; }
    tbody tr { cursor: pointer; transition: background 0.12s; }
    tbody tr:hover { background: rgba(255, 255, 255, 0.03); }

    .rank-badge {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 0.85rem;
      background: var(--surface-2);
      color: var(--muted);
    }
    .rank-1 { background: var(--gold-bg); color: var(--gold); }
    .rank-2 { background: var(--silver-bg); color: var(--silver); }
    .rank-3 { background: var(--bronze-bg); color: var(--bronze); }

    .bar-wrap {
      width: 120px;
      height: 8px;
      background: var(--bg);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 5px;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
    }

    .grid-inline {
      font-family: monospace;
      font-size: 0.72rem;
      line-height: 1.2;
      white-space: pre;
    }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(5, 8, 17, 0.78);
      backdrop-filter: blur(4px);
      display: none;
      place-items: center;
      padding: 16px;
      z-index: 50;
    }
    .modal-backdrop.open { display: grid; }

    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      width: 100%;
      max-width: 440px;
      padding: 24px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .modal-header h2 { margin: 0; font-size: 1.2rem; }

    .close-btn {
      background: transparent;
      color: var(--muted);
      font-size: 1.3rem;
      padding: 4px 8px;
    }

    .field { margin-bottom: 14px; }
    .field label {
      display: block;
      font-size: 0.82rem;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 6px;
    }

    input, textarea {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 11px 13px;
      border-radius: 10px;
      font-size: 0.95rem;
    }
    input:focus, textarea:focus { outline: none; border-color: var(--accent); }

    .pin-input {
      letter-spacing: 10px;
      font-size: 1.3rem;
      font-weight: 800;
      text-align: center;
    }

    textarea {
      min-height: 135px;
      font-family: monospace;
      font-size: 0.85rem;
      resize: vertical;
    }

    .preview-box {
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 0.85rem;
      margin-bottom: 14px;
      color: var(--muted);
    }

    .msg {
      font-size: 0.85rem;
      margin-top: 10px;
      min-height: 1.2em;
    }
    .msg.err { color: #f87171; }
    .msg.ok { color: var(--green); }

    .empty-state {
      text-align: center;
      color: var(--muted);
      padding: 36px 16px;
    }

    @media (max-width: 600px) {
      .podium { gap: 6px; }
      .podium-name { font-size: 0.85rem; max-width: 95px; }
      .mini-grid { font-size: 0.52rem; }
      .hide-mobile { display: none; }
    }
  </style>
</head>
<body>
  <div class="app">
    <!-- Top Navigation -->
    <header class="topbar">
      <div class="brand">
        <div class="brand-icon">📏</div>
        <div>
          <h1>Size It Up</h1>
          <span>Stigatafla &amp; Meðaltöl</span>
        </div>
      </div>

      <div class="nav-actions">
        <a class="btn btn-secondary" href="https://magnitudle.com/size-it-up" target="_blank">Spila leikinn ↗</a>
        <div id="authArea"></div>
        <button class="btn-primary" onclick="openSubmitModal()">+ Skrá skor</button>
      </div>
    </header>

    <!-- View Mode & Puzzle Selector -->
    <div class="controls-bar">
      <div class="tabs">
        <button class="tab active" id="tabDaily" onclick="switchMode('daily')">Dagleg staða</button>
        <button class="tab" id="tabAverage" onclick="switchMode('average')">Heildarmeðaltal</button>
      </div>

      <div id="puzzleFilterWrap">
        <select id="puzzleSelect" onchange="renderAll()"></select>
      </div>
    </div>

    <!-- Top 3 Podium -->
    <section class="podium-wrapper">
      <div class="podium-title" id="podiumHeading">Efstu 3 sætin</div>
      <div class="podium" id="podiumContainer"></div>
    </section>

    <!-- Full Standings Table -->
    <section class="card">
      <div id="tableContainer"></div>
    </section>
  </div>

  <!-- Auth Modal (Login / Register with 4-digit PIN) -->
  <div class="modal-backdrop" id="authModal">
    <div class="modal">
      <div class="modal-header">
        <h2 id="authModalTitle">Innskráning</h2>
        <button class="close-btn" onclick="closeModals()">✕</button>
      </div>

      <div class="tabs" style="width:100%; margin-bottom:16px;">
        <button class="tab active" id="authTabLogin" style="flex:1;" onclick="setAuthTab('login')">Skrá inn</button>
        <button class="tab" id="authTabRegister" style="flex:1;" onclick="setAuthTab('register')">Nýr aðgangur</button>
      </div>

      <div class="field">
        <label for="authName">Nafn</label>
        <input type="text" id="authName" placeholder="T.d. Jón" maxlength="25" />
      </div>

      <div class="field">
        <label for="authPin">4 tölustafa PIN-númer</label>
        <input type="password" id="authPin" class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" />
      </div>

      <button class="btn-primary" style="width:100%; justify-content:center;" id="authSubmitBtn" onclick="handleAuth()">Skrá inn</button>
      <div class="msg" id="authMsg"></div>
    </div>
  </div>

  <!-- Submit Score Modal -->
  <div class="modal-backdrop" id="submitModal">
    <div class="modal">
      <div class="modal-header">
        <h2>Skrá dagsins skor</h2>
        <button class="close-btn" onclick="closeModals()">✕</button>
      </div>

      <div class="field">
        <label for="shareInput">Límdu niðurstöðuna úr Size It Up (Share)</label>
        <textarea id="shareInput" oninput="updateParsePreview()" placeholder="Size It Up&#10;#103&#10;&#10;Score: 314/500&#10;&#10;⬜⬜⬜⬜⬜ 9&#10;🟥🟥🟥🟥⬜ 83&#10;..."></textarea>
      </div>

      <div class="preview-box" id="parsePreview">Límdu textann hér að ofan til að forskoða stigin.</div>

      <button class="btn-primary" style="width:100%; justify-content:center;" onclick="submitScore()">Vista á stigatöflu</button>
      <div class="msg" id="submitMsg"></div>
    </div>
  </div>

  <!-- Player History Modal -->
  <div class="modal-backdrop" id="playerModal">
    <div class="modal">
      <div class="modal-header">
        <h2 id="playerModalTitle">Saga leikmanns</h2>
        <button class="close-btn" onclick="closeModals()">✕</button>
      </div>
      <div id="playerHistoryBody"></div>
    </div>
  </div>

  <script>
    let state = {
      users: [],
      scores: [],
      mode: 'daily',
      authMode: 'login',
      currentUser: JSON.parse(localStorage.getItem('sizeitup_session') || 'null')
    };

    async function fetchData() {
      try {
        const res = await fetch('?api=data');
        const json = await res.json();
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

      const endpoint = state.authMode === 'login' ? '?api=login' : '?api=register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin })
      });
      const data = await res.json();

      if (!res.ok) {
        msg.className = 'msg err';
        msg.textContent = data.error || 'Villa kom upp.';
        return;
      }

      state.currentUser = { name: data.name, pin };
      localStorage.setItem('sizeitup_session', JSON.stringify(state.currentUser));
      closeModals();
      await fetchData();
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

      const res = await fetch('?api=score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.currentUser.name,
          pin: state.currentUser.pin,
          ...parsed
        })
      });
      const data = await res.json();

      if (!res.ok) {
        msg.className = 'msg err';
        msg.textContent = data.error || 'Tókst ekki að vista skor.';
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
  </script>
</body>
</html>