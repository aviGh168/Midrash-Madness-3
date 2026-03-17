/**
 * userBracketPage.js  —  Midrash Madness: My Bracket
 *
 * Reads ?bracketId=N from the URL, fetches:
 *   GET /api/bracket/user/{N}  — the user's picks (name + 6 round winner arrays)
 *   GET /api/bracket/midrashim — all 64 midrashim (for labels and the key)
 *
 * Renders:
 *   1. A read-only bracket overlay (same bracketImage.png as bracketPage.js /
 *      resultsPage.js) showing the user's individual picks, green-highlighted
 *      winners at every stage.
 *   2. A two-column key table listing all 64 midrashim (group-seed + short_desc),
 *      sorted by group then seed.
 *
 * Layout constants are copied verbatim from bracketPage.js / resultsPage.js —
 * same image, same coordinate system.
 */

// ─── Layout constants (identical to bracketPage.js) ───────────────────────────

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

const SEMI_Y     = [47.87, 49.89, 51.92];
const FINAL_Y    = [47.87, 49.89, 51.92];
const CHAMP_BOX_Y = [54.00, 56.00];

const GROUP_NAMES = ['A', 'B', 'C', 'D'];

/**
 * Standard bracket seed pairing for a 16-seed group, visual top-to-bottom order.
 * [seedIndex0, seedIndex1] — index 0 = seed 1 (0-indexed).
 */
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

// ─── State ────────────────────────────────────────────────────────────────────

/** All 64 midrashim from /api/bracket/midrashim, sorted by group then seed. */
let allMidrashim = [];

/** { A: [...16], B: [...16], C: [...16], D: [...16] } */
let groups = {};

/**
 * The user's picks — same shape as bracketPage.js `winners`.
 * Populated from the API response round arrays.
 */
let userWinners = {
    1: new Array(32).fill(null),
    2: new Array(16).fill(null),
    3: new Array(8).fill(null),
    4: new Array(4).fill(null),
    5: new Array(2).fill(null),
    6: new Array(1).fill(null),
};

/** Guards against duplicate resize listeners on re-renders. */
let resizeListenerAttached = false;

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

// ─── Image height (identical to bracketPage.js) ───────────────────────────────

function requiredImageHeight() {
    let minFrac = Infinity;
    for (const [t, m, b] of R1_Y) {
        minFrac = Math.min(minFrac, (m - t) / 100, (b - m) / 100);
    }
    return Math.ceil(MIN_BOX_PX / minFrac);
}

// ─── Contestant lookup (mirrors bracketPage.js getContestants exactly) ────────

/**
 * Returns [midrashA, midrashB] for the two contestants in a given matchup.
 * Round 1: reads from initial group seeding.
 * Rounds 2-4: reads from the previous round's userWinners.
 * Round 5: reads from userWinners[4] (group champions).
 * Round 6: reads from userWinners[5] (semi-final winners).
 */
function getContestants(round, globalIdx) {
    if (round === 1) {
        const groupIdx = Math.floor(globalIdx / 8);
        const localIdx = globalIdx % 8;
        const group = groups[GROUP_NAMES[groupIdx]];
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

// ─── Overlay factory (read-only, mirrors resultsPage.js makeOverlay) ─────────

/**
 * Builds a positioned overlay div for one matchup.
 * No click handlers — purely display.
 *
 * @param {object} o  { left, top, width, height, labelA, labelB, winnerId, mA, mB }
 */
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

// ─── Main bracket render ──────────────────────────────────────────────────────

function renderBracket() {
    const stage = el('bracket-stage');
    if (!stage) return;

    // Remove stale overlays
    stage.querySelectorAll('.bracket-overlay').forEach(d => d.remove());

    // Enforce minimum readable height
    el('bracket-img').style.height = requiredImageHeight() + 'px';

    // ── ROUND 1 ──────────────────────────────────────────────────────────────
    // R1_Y has 16 entries. Groups A+B → left (L_R1), C+D → right (R_R1).
    // gi 0 (A): yIdx 0-7; gi 1 (B): yIdx 8-15; gi 2 (C): 0-7; gi 3 (D): 8-15.
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
                labelA:   mA ? `${gName}-${mA.seed}` : '',
                labelB:   mB ? `${gName}-${mB.seed}` : '',
                winnerId, mA, mB,
            }));
        }
    }

    // ── ROUND 2 ──────────────────────────────────────────────────────────────
    // R2_Y has 8 entries. Groups A+B → L_R2, C+D → R_R2.
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
                labelA:   mA ? `${mA.group}-${mA.seed}` : '',
                labelB:   mB ? `${mB.group}-${mB.seed}` : '',
                winnerId, mA, mB,
            }));
        }
    }

    // ── ROUND 3 ──────────────────────────────────────────────────────────────
    // R3_Y has 4 entries. Groups A+B → L_R3, C+D → R_R3.
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
                labelA:   mA ? `${mA.group}-${mA.seed}` : '',
                labelB:   mB ? `${mB.group}-${mB.seed}` : '',
                winnerId, mA, mB,
            }));
        }
    }

    // ── ROUND 4 (group finals) ────────────────────────────────────────────────
    // R4_Y has 2 entries (one per image half). Groups A+B → L_R4, C+D → R_R4.
    for (let gi = 0; gi < 4; gi++) {
        const col  = gi < 2 ? COL.L_R4 : COL.R_R4;
        const yIdx = gi % 2;   // 0 for A/C, 1 for B/D
        const [ytop, , ybot] = R4_Y[yIdx];
        const [mA, mB]  = getContestants(4, gi);
        const winnerId  = userWinners[4][gi];

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA:   mA ? `${mA.group}-${mA.seed}` : '',
            labelB:   mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
        }));
    }

    // ── ROUND 5 (semi-finals) ─────────────────────────────────────────────────
    // Left: A-champ vs B-champ → L_SEMI; Right: C-champ vs D-champ → R_SEMI.
    for (let i = 0; i < 2; i++) {
        const col = i === 0 ? COL.L_SEMI : COL.R_SEMI;
        const [ytop, , ybot] = SEMI_Y;
        const [mA, mB]  = getContestants(5, i);
        const winnerId  = userWinners[5][i];

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA:   mA ? `${mA.group}-${mA.seed}` : '',
            labelB:   mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
        }));
    }

    // ── ROUND 6 (final) ──────────────────────────────────────────────────────
    {
        const [ytop, , ybot] = FINAL_Y;
        const [mA, mB]  = getContestants(6, 0);
        const winnerId  = userWinners[6][0];

        stage.appendChild(makeOverlay({
            left: COL.CHAMP[0], top: ytop, width: COL.CHAMP[1], height: ybot - ytop,
            labelA:   mA ? `${mA.group}-${mA.seed}` : '',
            labelB:   mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
        }));
    }

    // ── CHAMPION DISPLAY BOX ─────────────────────────────────────────────────
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

// ─── Key table rendering ──────────────────────────────────────────────────────

/**
 * Renders a two-column key table listing all 64 midrashim sorted by group
 * then seed, with columns: Seed (e.g. "A-3") and Midrash (short_desc).
 * Mirrors the half-table pattern from resultsPage.js renderTable().
 */
function renderKey() {
    // Sort: group A→D, then seed 1→16 within each group
    const sorted = allMidrashim.slice().sort((a, b) => {
        const gc = a.group.localeCompare(b.group);
        return gc !== 0 ? gc : a.seed - b.seed;
    });

    /**
     * Builds one half-table HTML string covering sorted[start..end).
     */
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

// ─── Data loading ─────────────────────────────────────────────────────────────

/**
 * Reads bracketId from the URL query string (?bracketId=N).
 * Returns the integer id, or null if missing / invalid.
 */
function getBracketIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw    = params.get('bracketId');
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Fetches the user's bracket and all 64 midrashim in parallel, then renders.
 */
async function loadUserBracket() {
    const bracketId = getBracketIdFromUrl();

    if (bracketId === null) {
        el('bracket-wrapper').innerHTML =
            '<div class="bracket-error">' +
            'No bracket ID provided. Please use a link of the form ' +
            '<code>userBracketPage.html?bracketId=1</code>.' +
            '</div>';
        return;
    }

    el('bracket-wrapper').innerHTML = '<div id="bracket-loading">Loading bracket&hellip;</div>';

    try {
        const [bracketResp, midrashResp] = await Promise.all([
            fetch(`/api/bracket/user/${bracketId}`),
            fetch('/api/bracket/midrashim'),
        ]);

        // Handle 404 explicitly for a clean user-facing message
        if (bracketResp.status === 404) {
            el('bracket-wrapper').innerHTML =
                `<div class="bracket-error">No bracket found with ID ${escapeHtml(String(bracketId))}.</div>`;
            return;
        }
        if (!bracketResp.ok) throw new Error(`Bracket fetch failed (${bracketResp.status})`);
        if (!midrashResp.ok) throw new Error(`Midrashim fetch failed (${midrashResp.status})`);

        const bracketData = await bracketResp.json();
        const midrashData = await midrashResp.json();

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

        // Populate userWinners from the API response
        userWinners[1] = bracketData.round1Winners ?? new Array(32).fill(null);
        userWinners[2] = bracketData.round2Winners ?? new Array(16).fill(null);
        userWinners[3] = bracketData.round3Winners ?? new Array(8).fill(null);
        userWinners[4] = bracketData.round4Winners ?? new Array(4).fill(null);
        userWinners[5] = bracketData.round5Winners ?? new Array(2).fill(null);
        userWinners[6] = bracketData.round6Winners ?? new Array(1).fill(null);

        // Update page title with submitter's name.
        // textContent and document.title are plain-text sinks — do NOT pass
        // HTML-escaped strings into them or entities like &amp; will appear
        // literally on screen. escapeHtml is only needed for values injected
        // into innerHTML (e.g. the alt attribute below).
        const name        = bracketData.name ?? 'Unknown';
        const escapedName = escapeHtml(name);
        el('page-title').textContent = `${name}'s Bracket`;
        document.title               = `Midrash Madness — ${name}'s Bracket`;

        // Build bracket stage (innerHTML context — use escapedName for attributes)
        el('bracket-wrapper').innerHTML = `
            <div id="bracket-stage">
                <img id="bracket-img" src="bracketImage.png" alt="${escapedName}'s Bracket" draggable="false" />
            </div>`;

        if (!resizeListenerAttached) {
            window.addEventListener('resize', renderBracket);
            resizeListenerAttached = true;
        }

        renderBracket();
        renderKey();

    } catch (err) {
        el('bracket-wrapper').innerHTML =
            `<div class="bracket-error">` +
            `Failed to load bracket: ${escapeHtml(err.message)}<br>` +
            `Please refresh or contact an administrator.` +
            `</div>`;
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Nav scroll behaviour matches bracketPage.js / resultsPage.js
    const nav = document.querySelector('nav');
    nav.classList.remove('active');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('active', window.scrollY > nav.offsetHeight + 5);
    });

    loadUserBracket();
});