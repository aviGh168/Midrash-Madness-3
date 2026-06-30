/**
 * adminPage.js  —  Midrash Madness: Admin
 *
 * Flow:
 *   1. Admin enters the password in the gate form.
 *   2. POST /api/admin/auth (X-Admin-Password header) — 200 unlocks the page,
 *      401 shows an error and keeps the gate visible.
 *   3. On success, GET /api/bracket/midrashim and GET /api/admin/brackets are
 *      fetched in parallel. The midrashim are stored once for the session.
 *      The bracket list populates the dropdown, sorted A→Z (server already
 *      orders them, but we trust the sort regardless).
 *   4. When the admin picks a name, GET /api/admin/brackets/{bracketId} fetches
 *      that user's picks (gated by the admin password). The bracket overlay is
 *      rebuilt in-place; the key table is rendered once and then left alone.
 *
 * The password is kept in the module-level `sessionPassword` variable and sent
 * with every subsequent request, so the server-side guard cannot be bypassed
 * by calling the APIs directly from the browser.
 *
 * Bracket rendering is identical to userBracketPage.js — same image, same
 * coordinate system, same overlay logic.
 */

// ─── Layout constants (identical to bracketPage.js / userBracketPage.js) ──────

const MIN_BOX_PX = 38;

const COL = {
    L_R1:   [1.46,  10.17],
    L_R2:   [12.29, 10.15],
    L_R3:   [17.33, 10.17],
    L_R4:   [24.96, 10.17],
    L_SEMI: [31.73, 10.17],
    CHAMP:  [45.02, 10.15],
    R_SEMI: [58.10, 10.17],
    R_R4:   [64.88, 10.17],
    R_R3:   [72.50, 10.17],
    R_R2:   [77.52, 10.15],
    R_R1:   [88.33, 10.15],
};

const R1_Y = [
    [ 1.87,  3.89,  5.92],
    [ 8.03, 10.04, 12.05],
    [14.16, 16.17, 18.21],
    [20.29, 22.31, 24.35],
    [26.45, 28.47, 30.48],
    [32.59, 34.60, 36.64],
    [38.72, 40.73, 42.77],
    [44.88, 46.89, 48.91],
    [51.01, 53.03, 55.07],
    [57.15, 59.16, 61.20],
    [63.31, 65.32, 67.33],
    [69.44, 71.45, 73.49],
    [75.57, 77.59, 79.63],
    [81.71, 83.72, 85.76],
    [87.87, 89.88, 91.92],
    [94.00, 96.01, 98.05],
];

const R2_Y = [
    [ 5.01,  7.04,  9.07],
    [17.31, 19.33, 21.36],
    [29.60, 31.63, 33.65],
    [41.87, 43.89, 45.92],
    [54.16, 56.19, 58.21],
    [66.45, 68.45, 70.48],
    [78.72, 80.75, 82.77],
    [91.01, 93.04, 95.07],
];

const R3_Y = [
    [11.01, 13.04, 15.07],
    [35.57, 37.60, 39.63],
    [60.13, 62.16, 64.19],
    [84.72, 86.75, 88.77],
];

const R4_Y = [
    [23.31, 25.32, 27.33],
    [72.43, 74.45, 76.48],
];

const SEMI_Y      = [47.87, 49.89, 51.92];
const FINAL_Y     = [47.87, 49.89, 51.92];
const CHAMP_BOX_Y = [54.00, 56.00];

const GROUP_NAMES = ['A', 'B', 'C', 'D'];

const SEED_PAIRS_R1 = [
    [0, 15],  // 1 vs 16
    [7,  8],  // 8 vs 9
    [4, 11],  // 5 vs 12
    [3, 12],  // 4 vs 13
    [2, 13],  // 3 vs 14
    [5, 10],  // 6 vs 11
    [6,  9],  // 7 vs 10
    [1, 14],  // 2 vs 15
];

// ─── Session state ────────────────────────────────────────────────────────────

/** Password supplied at login; sent as X-Admin-Password on every request. */
let sessionPassword = '';

/** All 64 midrashim — loaded once after login, never reloaded. */
let allMidrashim = [];

/** { A:[...16], B:[...16], C:[...16], D:[...16] } */
let groups = {};

/**
 * The currently displayed user's picks.
 * Reset and repopulated each time the dropdown changes.
 */
let userWinners = {
    1: new Array(32).fill(null),
    2: new Array(16).fill(null),
    3: new Array(8).fill(null),
    4: new Array(4).fill(null),
    5: new Array(2).fill(null),
    6: new Array(1).fill(null),
};

/** True once the resize listener has been attached to window. */
let resizeListenerAttached = false;

/** True once the key table has been rendered (only needs to happen once). */
let keyRendered = false;

/**
 * Incremented each time the admin selects a new dropdown entry.
 * Each async fetch captures the value at the time it starts; if it
 * no longer matches when the response arrives, a newer selection has
 * been made and this result is silently discarded (prevents races).
 */
let selectionGeneration = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}

function midrashById(id) {
    if (id == null) return null;
    return allMidrashim.find(m => m.midrash_id === id) ?? null;
}

/** Returns headers including the admin password for every protected request. */
function adminHeaders() {
    return { 'X-Admin-Password': sessionPassword };
}

// ─── Image height (identical to bracketPage.js) ───────────────────────────────

function requiredImageHeight() {
    let minFrac = Infinity;
    for (const [t, m, b] of R1_Y) {
        minFrac = Math.min(minFrac, (m - t) / 100, (b - m) / 100);
    }
    return Math.ceil(MIN_BOX_PX / minFrac);
}

// ─── Contestant lookup (identical to userBracketPage.js) ─────────────────────

function getContestants(round, globalIdx) {
    if (round === 1) {
        const groupIdx = Math.floor(globalIdx / 8);
        const localIdx = globalIdx % 8;
        const group    = groups[GROUP_NAMES[groupIdx]];
        if (!group) return [null, null];
        const [sA, sB] = SEED_PAIRS_R1[localIdx];
        return [group[sA], group[sB]];
    }
    if (round >= 2 && round <= 4) {
        const mPerGroup = [0, 0, 4, 2, 1][round];
        const groupIdx  = Math.floor(globalIdx / mPerGroup);
        const localIdx  = globalIdx % mPerGroup;
        const prevMPG   = [0, 8, 4, 2, 1][round - 1];
        const prevOff   = groupIdx * prevMPG;
        return [
            midrashById(userWinners[round - 1][prevOff + localIdx * 2]),
            midrashById(userWinners[round - 1][prevOff + localIdx * 2 + 1]),
        ];
    }
    if (round === 5) {
        if (globalIdx === 0) return [midrashById(userWinners[4][0]), midrashById(userWinners[4][1])];
        return [midrashById(userWinners[4][2]), midrashById(userWinners[4][3])];
    }
    if (round === 6) {
        return [midrashById(userWinners[5][0]), midrashById(userWinners[5][1])];
    }
    return [null, null];
}

// ─── Overlay factory (read-only, identical to userBracketPage.js) ─────────────

function makeOverlay(o) {
    const div = document.createElement('div');
    div.className = 'bracket-overlay';
    div.style.cssText = `left:${o.left}%;top:${o.top}%;width:${o.width}%;height:${o.height}%;`;

    const rowA = document.createElement('div');
    rowA.className = 'overlay-seed-row overlay-seed-top';
    rowA.textContent = o.labelA ?? '';

    const rowB = document.createElement('div');
    rowB.className = 'overlay-seed-row overlay-seed-bot';
    rowB.textContent = o.labelB ?? '';

    if (o.winnerId != null) {
        div.classList.add('overlay-decided');
        if (o.mA && o.mA.midrash_id === o.winnerId) rowA.classList.add('overlay-winner-row');
        if (o.mB && o.mB.midrash_id === o.winnerId) rowB.classList.add('overlay-winner-row');
    } else {
        div.classList.add('overlay-empty');
    }

    div.appendChild(rowA);
    div.appendChild(rowB);
    return div;
}

// ─── Bracket render (identical structure to userBracketPage.js) ───────────────

function renderBracket() {
    const stage = el('bracket-stage');
    if (!stage) return;

    stage.querySelectorAll('.bracket-overlay').forEach(d => d.remove());
    el('bracket-img').style.height = requiredImageHeight() + 'px';

    // ── Round 1 ──────────────────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col   = gi < 2 ? COL.L_R1 : COL.R_R1;
        const gName = GROUP_NAMES[gi];

        for (let li = 0; li < 8; li++) {
            const globalIdx = gi * 8 + li;
            const yIdx      = (gi % 2) * 8 + li;
            const [ytop, , ybot] = R1_Y[yIdx];
            const [mA, mB]  = getContestants(1, globalIdx);
            const winnerId  = userWinners[1][globalIdx];

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA: mA ? `${gName}-${mA.seed}` : '',
                labelB: mB ? `${gName}-${mB.seed}` : '',
                winnerId, mA, mB,
            }));
        }
    }

    // ── Round 2 ──────────────────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col = gi < 2 ? COL.L_R2 : COL.R_R2;

        for (let li = 0; li < 4; li++) {
            const globalIdx = gi * 4 + li;
            const yIdx      = (gi % 2) * 4 + li;
            const [ytop, , ybot] = R2_Y[yIdx];
            const [mA, mB]  = getContestants(2, globalIdx);
            const winnerId  = userWinners[2][globalIdx];

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA: mA ? `${mA.group}-${mA.seed}` : '',
                labelB: mB ? `${mB.group}-${mB.seed}` : '',
                winnerId, mA, mB,
            }));
        }
    }

    // ── Round 3 ──────────────────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col = gi < 2 ? COL.L_R3 : COL.R_R3;

        for (let li = 0; li < 2; li++) {
            const globalIdx = gi * 2 + li;
            const yIdx      = (gi % 2) * 2 + li;
            const [ytop, , ybot] = R3_Y[yIdx];
            const [mA, mB]  = getContestants(3, globalIdx);
            const winnerId  = userWinners[3][globalIdx];

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA: mA ? `${mA.group}-${mA.seed}` : '',
                labelB: mB ? `${mB.group}-${mB.seed}` : '',
                winnerId, mA, mB,
            }));
        }
    }

    // ── Round 4 (group finals) ────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col  = gi < 2 ? COL.L_R4 : COL.R_R4;
        const yIdx = gi % 2;
        const [ytop, , ybot] = R4_Y[yIdx];
        const [mA, mB]  = getContestants(4, gi);
        const winnerId  = userWinners[4][gi];

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA: mA ? `${mA.group}-${mA.seed}` : '',
            labelB: mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
        }));
    }

    // ── Round 5 (semi-finals) ─────────────────────────────────────────────────
    for (let i = 0; i < 2; i++) {
        const col = i === 0 ? COL.L_SEMI : COL.R_SEMI;
        const [ytop, , ybot] = SEMI_Y;
        const [mA, mB]  = getContestants(5, i);
        const winnerId  = userWinners[5][i];

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA: mA ? `${mA.group}-${mA.seed}` : '',
            labelB: mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
        }));
    }

    // ── Round 6 (final) ──────────────────────────────────────────────────────
    {
        const [ytop, , ybot] = FINAL_Y;
        const [mA, mB]  = getContestants(6, 0);
        const winnerId  = userWinners[6][0];

        stage.appendChild(makeOverlay({
            left: COL.CHAMP[0], top: ytop, width: COL.CHAMP[1], height: ybot - ytop,
            labelA: mA ? `${mA.group}-${mA.seed}` : '',
            labelB: mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
        }));
    }

    // ── Champion display box ──────────────────────────────────────────────────
    {
        const champId = userWinners[6][0];
        const champ   = midrashById(champId);
        const div = document.createElement('div');
        div.className = 'bracket-overlay bracket-overlay-champ';
        div.style.cssText =
            `left:${COL.CHAMP[0]}%;top:${CHAMP_BOX_Y[0]}%;` +
            `width:${COL.CHAMP[1]}%;height:${CHAMP_BOX_Y[1] - CHAMP_BOX_Y[0]}%;`;
        if (champ) {
            const row = document.createElement('div');
            row.className = 'overlay-seed-row overlay-champ-label';
            row.textContent = `${champ.group}-${champ.seed}`;
            div.appendChild(row);
        }
        stage.appendChild(div);
    }
}

// ─── Key table (rendered once; stays visible for all subsequent selections) ───

function renderKey() {
    if (keyRendered) return;
    keyRendered = true;

    const sorted = allMidrashim.slice().sort((a, b) => {
        const gc = a.group.localeCompare(b.group);
        return gc !== 0 ? gc : a.seed - b.seed;
    });

    function buildHalfTable(start, end) {
        let rows = '';
        for (let j = start; j < end; j++) {
            const m = sorted[j];
            rows +=
                '<tr>' +
                `<td class="col-seed">${escapeHtml(m.group)}-${m.seed}</td>` +
                `<td class="col-desc">${escapeHtml(m.short_desc || '')}</td>` +
                '</tr>';
        }
        return (
            '<div class="key-table-shell">' +
            '<table class="key-table">' +
            '<thead><tr>' +
            '<th class="col-seed">Seed</th>' +
            '<th class="col-desc">Midrash</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>' +
            '</div>'
        );
    }

    el('key-wrapper').innerHTML =
        '<div id="key-tables-row">' +
        buildHalfTable(0, 32) +
        buildHalfTable(32, 64) +
        '</div>';

    el('key-section').style.display = 'block';
}

// ─── Leaderboard (closest to the People's Bracket) ─────────────────────────

/**
 * Renders the leaderboard table from an array of { rank, name, points }.
 * Mirrors the rank/medal/pts-badge styling used on resultsPage.js's main table.
 */
function renderLeaderboard(entries) {
    const wrapper = el('leaderboard-wrapper');

    if (!Array.isArray(entries) || entries.length === 0) {
        wrapper.innerHTML = '<div class="leaderboard-error">No submissions yet.</div>';
        return;
    }

    let rows = '';
    for (const entry of entries) {
        const r = entry.rank;

        const rowClass = (r === 1) ? ' class="rank-1"'
            : (r === 2) ? ' class="rank-2"'
                : (r === 3) ? ' class="rank-3"'
                    : '';
        const medal = (r === 1) ? '<span class="rank-medal">&#x1F947;</span>'
            : (r === 2) ? '<span class="rank-medal">&#x1F948;</span>'
                : (r === 3) ? '<span class="rank-medal">&#x1F949;</span>'
                    : '';

        rows += '<tr' + rowClass + '>'
            + '<td class="col-rank">' + r + medal + '</td>'
            + '<td class="col-name">' + escapeHtml(entry.name) + '</td>'
            + '<td class="col-pts"><span class="pts-badge">' + entry.points + '</span></td>'
            + '</tr>';
    }

    wrapper.innerHTML =
        '<div class="leaderboard-table-shell">' +
        '<table class="leaderboard-table">' +
        '<thead><tr>' +
        '<th class="col-rank">Rank</th>' +
        '<th class="col-name">Name</th>' +
        '<th class="col-pts">Pts</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '</div>';
}

/**
 * Fetches the leaderboard from GET /api/admin/leaderboard and renders it.
 * Called once during initAdminContent, right after login.
 */
async function loadLeaderboard() {
    const wrapper = el('leaderboard-wrapper');
    wrapper.innerHTML = '<div id="leaderboard-loading">Loading leaderboard&hellip;</div>';

    try {
        const resp = await fetch('/api/admin/leaderboard', { headers: adminHeaders() });

        if (resp.status === 401) {
            alert('Session expired. Please refresh and log in again.');
            window.location.reload();
            return;
        }
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

        const entries = await resp.json();
        renderLeaderboard(entries);

    } catch (err) {
        wrapper.innerHTML =
            `<div class="leaderboard-error">Failed to load leaderboard: ${escapeHtml(err.message)}</div>`;
    }
}

// ─── Bracket selection ────────────────────────────────────────────────────────

/**
 * Called when the admin picks a name from the dropdown.
 * Fetches that user's bracket and re-renders the bracket overlay in-place.
 * The bracket stage image element is kept across selections to avoid a visible
 * re-flash; only the overlays are removed and rebuilt.
 */
async function onUserSelected() {
    const select         = el('user-select');
    const bracketId      = parseInt(select.value, 10);
    const myGeneration   = ++selectionGeneration;  // capture before any await

    // Blank / prompt option selected — clear and show placeholder
    if (!bracketId) {
        el('bracket-wrapper').innerHTML =
            '<p id="bracket-placeholder">Select a name above to view their bracket.</p>';
        return;
    }

    // Show a loading indicator inside the wrapper, but preserve the stage element
    // if it already exists so the image doesn't flicker on rapid selections.
    const existingStage = el('bracket-stage');
    if (!existingStage) {
        el('bracket-wrapper').innerHTML =
            '<div id="bracket-stage">' +
            '<img id="bracket-img" src="bracketImage.png" alt="Bracket" draggable="false" />' +
            '</div>';

        if (!resizeListenerAttached) {
            window.addEventListener('resize', renderBracket);
            resizeListenerAttached = true;
        }
    }

    // Clear overlays immediately so the old person's picks aren't visible
    // while the new request is in flight.
    const stage = el('bracket-stage');
    stage.querySelectorAll('.bracket-overlay').forEach(d => d.remove());

    try {
        const resp = await fetch(`/api/admin/brackets/${bracketId}`, {
            headers: adminHeaders(),
        });

        if (resp.status === 401) {
            // Session password was somehow invalidated — reload the page.
            alert('Session expired. Please refresh and log in again.');
            window.location.reload();
            return;
        }
        if (resp.status === 404) {
            el('bracket-wrapper').innerHTML =
                `<div class="bracket-error">Bracket not found (ID ${escapeHtml(String(bracketId))}).</div>`;
            return;
        }
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

        const data = await resp.json();

        // If a newer selection was made while this fetch was in-flight,
        // discard this result silently — the newer request will render.
        if (myGeneration !== selectionGeneration) return;

        // Populate userWinners from the fetched bracket
        userWinners[1] = data.round1Winners ?? new Array(32).fill(null);
        userWinners[2] = data.round2Winners ?? new Array(16).fill(null);
        userWinners[3] = data.round3Winners ?? new Array(8).fill(null);
        userWinners[4] = data.round4Winners ?? new Array(4).fill(null);
        userWinners[5] = data.round5Winners ?? new Array(2).fill(null);
        userWinners[6] = data.round6Winners ?? new Array(1).fill(null);

        renderBracket();
        renderKey();

    } catch (err) {
        el('bracket-wrapper').innerHTML =
            `<div class="bracket-error">` +
            `Failed to load bracket: ${escapeHtml(err.message)}<br>` +
            `Please try again or contact an administrator.` +
            `</div>`;
    }
}

// ─── Post-login initialisation ────────────────────────────────────────────────

/**
 * Fetches all midrashim and all bracket summaries in parallel.
 * Populates the dropdown and shows the admin content section.
 * Called once immediately after the password is verified.
 */
async function initAdminContent() {
    try {
        const [midrashResp, bracketsResp] = await Promise.all([
            fetch('/api/bracket/midrashim'),
            fetch('/api/admin/brackets', { headers: adminHeaders() }),
        ]);

        if (!midrashResp.ok)  throw new Error(`Midrashim fetch failed (${midrashResp.status})`);
        if (bracketsResp.status === 401) throw new Error('Unauthorized — incorrect password.');
        if (!bracketsResp.ok) throw new Error(`Brackets fetch failed (${bracketsResp.status})`);

        const midrashData  = await midrashResp.json();
        const bracketsData = await bracketsResp.json();

        // Validate midrash data
        if (!Array.isArray(midrashData) || midrashData.length !== 64) {
            throw new Error(
                `Expected 64 midrashim, got ${Array.isArray(midrashData) ? midrashData.length : typeof midrashData}`
            );
        }

        // Build allMidrashim and groups
        allMidrashim = midrashData;
        groups = { A: [], B: [], C: [], D: [] };
        midrashData.forEach(m => {
            const g = m.group?.toUpperCase();
            if (g && groups[g]) groups[g].push(m);
        });
        ['A', 'B', 'C', 'D'].forEach(g => {
            groups[g].sort((a, b) => a.seed - b.seed);
            if (groups[g].length !== 16) {
                throw new Error(`Group ${g} has ${groups[g].length} entries (expected 16)`);
            }
        });

        // Populate the dropdown (server already sorts by name A→Z)
        const select = el('user-select');
        // Remove any options beyond the placeholder that may exist from a previous attempt
        while (select.options.length > 1) select.remove(1);

        bracketsData.forEach(summary => {
            const opt = document.createElement('option');
            opt.value       = summary.bracket_id;
            opt.textContent = summary.name;
            select.appendChild(opt);
        });

        // Show bracket count
        const count = bracketsData.length;
        el('bracket-count-badge').textContent =
            count === 1 ? '1 bracket submitted' : `${count} brackets submitted`;

        // Show placeholder inside bracket wrapper
        el('bracket-wrapper').innerHTML =
            '<p id="bracket-placeholder">Select a name above to view their bracket.</p>';

        // Reveal admin content, hide auth gate
        el('auth-section').style.display  = 'none';
        el('admin-content').style.display = 'block';

        // Load the leaderboard (independent of the dropdown/bracket flow above;
        // failures here are shown inline in the leaderboard section and don't
        // block the rest of the admin page from working).
        loadLeaderboard();

    } catch (err) {
        // Something went wrong after auth — show error on the auth screen
        const errEl = el('auth-error');
        errEl.textContent  = `Initialization failed: ${err.message}`;
        errEl.style.display = 'block';
        const btn = el('auth-btn');
        btn.disabled        = false;
        btn.textContent     = 'Enter';
    }
}

// ─── Password gate ────────────────────────────────────────────────────────────

async function attemptLogin() {
    const input   = el('password-input');
    const errEl   = el('auth-error');
    const btn     = el('auth-btn');
    const password = input.value;

    if (!password) {
        errEl.textContent   = 'Please enter the admin password.';
        errEl.style.display = 'block';
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Checking\u2026';
    errEl.style.display = 'none';

    try {
        const resp = await fetch('/api/admin/auth', {
            method:  'POST',
            headers: { 'X-Admin-Password': password },
        });

        if (resp.status === 401) {
            errEl.textContent   = 'Incorrect password. Please try again.';
            errEl.style.display = 'block';
            btn.disabled        = false;
            btn.textContent     = 'Enter';
            input.value         = '';
            input.focus();
            return;
        }

        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

        // Password accepted — store it for subsequent requests and load content
        sessionPassword = password;
        input.value     = '';
        await initAdminContent();

    } catch (err) {
        errEl.textContent   = `Error: ${err.message}. Please try again.`;
        errEl.style.display = 'block';
        btn.disabled        = false;
        btn.textContent     = 'Enter';
    }
}

// ─── Ripple ───────────────────────────────────────────────────────────────────

function attachRipple(container) {
    container.querySelectorAll('.ripple').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const r = this.getBoundingClientRect();
            const c = document.createElement('span');
            c.className  = 'circle';
            c.style.top  = (e.clientY - r.top)  + 'px';
            c.style.left = (e.clientX - r.left) + 'px';
            this.appendChild(c);
            setTimeout(() => c.remove(), 500);
        });
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Nav scroll behaviour matches other pages
    const nav = document.querySelector('nav');
    nav.classList.remove('active');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('active', window.scrollY > nav.offsetHeight + 5);
    });

    // Password form wiring
    el('auth-btn').addEventListener('click', attemptLogin);

    // Allow pressing Enter in the password field to submit
    el('password-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') attemptLogin();
    });

    // Dropdown change handler
    el('user-select').addEventListener('change', onUserSelected);

    attachRipple(document.body);
});