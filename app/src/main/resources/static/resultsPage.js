/**
 * resultsPage.js  —  Midrash Madness Results
 *
 * Section 1: Sortable table of all 64 midrashim ranked by total points.
 *   Points = total appearances across ALL round winner tables (round_1 through round_6).
 *
 * Section 2: "The People's Bracket" — read-only bracket auto-filled by point totals.
 *   Uses the exact same image + overlay system as bracketPage.js.
 *   Tiebreak order:
 *     1. Total points (higher wins)
 *     2. Points earned in the specific round being decided
 *     3. Furthest round reached overall (e.g. appeared in round_3 vs only round_1)
 *     4. Random (indicated with "(random)" label on the matchup box)
 *
 * Layout constants (identical to bracketPage.js — same bracketImage.png).
 */

// ─── Layout constants (copied from bracketPage.js) ───────────────────────────

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

const SEMI_Y  = [47.87, 49.89, 51.92];
const FINAL_Y = [47.87, 49.89, 51.92];
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

// ─── State ────────────────────────────────────────────────────────────────────

/** All 64 midrashim from the API, sorted by group then seed. */
let allMidrashim = [];

/** { A: [...16], B: [...16], C: [...16], D: [...16] } */
let groups = {};

/**
 * pointMap: { midrash_id -> { total, byRound: {1,2,3,4,5,6}, maxRound } }
 * Populated from /api/results/points.
 */
let pointMap = {};

/**
 * Computed bracket winners for the People's Bracket.
 * Same shape as bracketPage.js `winners` but filled algorithmically.
 * Values are midrash_id integers (never null once computed).
 */
let bracketWinners = {
    1: new Array(32).fill(null),
    2: new Array(16).fill(null),
    3: new Array(8).fill(null),
    4: new Array(4).fill(null),
    5: new Array(2).fill(null),
    6: new Array(1).fill(null),
};

/**
 * Set of matchup keys that were decided by random tiebreak.
 * Each key is a string like "r3-2" (round-globalIdx).
 */
let randomTiebreaks = new Set();

/** Guards against adding duplicate resize listeners on manual refresh. */
let resizeListenerAttached = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function midrashById(id) {
    if (id == null) return null;
    return allMidrashim.find(m => m.midrash_id === id) ?? null;
}

function totalPoints(id) {
    return pointMap[id]?.total ?? 0;
}

function pointsInRound(id, round) {
    return pointMap[id]?.byRound?.[round] ?? 0;
}

function maxRoundReached(id) {
    return pointMap[id]?.maxRound ?? 0;
}

/**
 * Returns the midrash_id of the winner between idA and idB for a given round.
 * Applies the three-tier tiebreak, and if still tied, picks randomly and records it.
 *
 * @param {number} idA
 * @param {number} idB
 * @param {number} round   the round being decided (1-6)
 * @param {string} key     unique key for this matchup (for random tracking)
 * @returns {number} winning midrash_id
 */
function pickWinner(idA, idB, round, key) {
    // Tiebreak 1: total points
    const ptA = totalPoints(idA), ptB = totalPoints(idB);
    if (ptA !== ptB) return ptA > ptB ? idA : idB;

    // Tiebreak 2: points in this specific round
    const rptA = pointsInRound(idA, round), rptB = pointsInRound(idB, round);
    if (rptA !== rptB) return rptA > rptB ? idA : idB;

    // Tiebreak 3: furthest round reached
    const mrA = maxRoundReached(idA), mrB = maxRoundReached(idB);
    if (mrA !== mrB) return mrA > mrB ? idA : idB;

    // Tiebreak 4: random
    randomTiebreaks.add(key);
    return Math.random() < 0.5 ? idA : idB;
}

// ─── Image height (identical to bracketPage.js) ───────────────────────────────

function requiredImageHeight() {
    let minFrac = Infinity;
    for (const [t, m, b] of R1_Y) {
        minFrac = Math.min(minFrac, (m - t) / 100, (b - m) / 100);
    }
    return Math.ceil(MIN_BOX_PX / minFrac);
}

// ─── Bracket computation ──────────────────────────────────────────────────────

/**
 * Mirrors getContestants() from bracketPage.js but reads from bracketWinners.
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
            midrashById(bracketWinners[round - 1][prevOff + localIdx * 2]),
            midrashById(bracketWinners[round - 1][prevOff + localIdx * 2 + 1]),
        ];
    }
    if (round === 5) {
        if (globalIdx === 0) return [midrashById(bracketWinners[4][0]), midrashById(bracketWinners[4][1])];
        return [midrashById(bracketWinners[4][2]), midrashById(bracketWinners[4][3])];
    }
    if (round === 6) {
        return [midrashById(bracketWinners[5][0]), midrashById(bracketWinners[5][1])];
    }
    return [null, null];
}

/**
 * Fills bracketWinners for all 6 rounds using point-based tiebreaking.
 * Must be called after allMidrashim, groups, and pointMap are populated.
 */
function computeBracket() {
    randomTiebreaks = new Set();

    // Round 1: 32 matchups
    for (let gi = 0; gi < 32; gi++) {
        const [mA, mB] = getContestants(1, gi);
        if (!mA || !mB) { bracketWinners[1][gi] = mA?.midrash_id ?? mB?.midrash_id ?? null; continue; }
        bracketWinners[1][gi] = pickWinner(mA.midrash_id, mB.midrash_id, 1, `r1-${gi}`);
    }

    // Round 2: 16 matchups
    for (let gi = 0; gi < 16; gi++) {
        const [mA, mB] = getContestants(2, gi);
        if (!mA || !mB) { bracketWinners[2][gi] = mA?.midrash_id ?? mB?.midrash_id ?? null; continue; }
        bracketWinners[2][gi] = pickWinner(mA.midrash_id, mB.midrash_id, 2, `r2-${gi}`);
    }

    // Round 3: 8 matchups
    for (let gi = 0; gi < 8; gi++) {
        const [mA, mB] = getContestants(3, gi);
        if (!mA || !mB) { bracketWinners[3][gi] = mA?.midrash_id ?? mB?.midrash_id ?? null; continue; }
        bracketWinners[3][gi] = pickWinner(mA.midrash_id, mB.midrash_id, 3, `r3-${gi}`);
    }

    // Round 4: 4 matchups (group finals)
    for (let gi = 0; gi < 4; gi++) {
        const [mA, mB] = getContestants(4, gi);
        if (!mA || !mB) { bracketWinners[4][gi] = mA?.midrash_id ?? mB?.midrash_id ?? null; continue; }
        bracketWinners[4][gi] = pickWinner(mA.midrash_id, mB.midrash_id, 4, `r4-${gi}`);
    }

    // Round 5: 2 matchups (semi-finals)
    for (let i = 0; i < 2; i++) {
        const [mA, mB] = getContestants(5, i);
        if (!mA || !mB) { bracketWinners[5][i] = mA?.midrash_id ?? mB?.midrash_id ?? null; continue; }
        bracketWinners[5][i] = pickWinner(mA.midrash_id, mB.midrash_id, 5, `r5-${i}`);
    }

    // Round 6: final
    {
        const [mA, mB] = getContestants(6, 0);
        if (!mA || !mB) { bracketWinners[6][0] = mA?.midrash_id ?? mB?.midrash_id ?? null; }
        else bracketWinners[6][0] = pickWinner(mA.midrash_id, mB.midrash_id, 6, `r6-0`);
    }
}

// ─── Table rendering ──────────────────────────────────────────────────────────────────────────────

/**
 * Renders two side-by-side half-tables: ranks 1-32 left, 33-64 right.
 * Each half has its own identical header row.
 * On narrow screens (<= CSS breakpoint) they stack into a single column.
 */
function renderTable() {
    var wrapper = el('table-wrapper');

    // Sort: highest points first; stable secondary sort by group then seed
    var ranked = allMidrashim.map(function(m) {
        return { m: m, pts: totalPoints(m.midrash_id) };
    });
    ranked.sort(function(a, b) {
        if (b.pts !== a.pts) return b.pts - a.pts;
        var gc = a.m.group.localeCompare(b.m.group);
        if (gc !== 0) return gc;
        return a.m.seed - b.m.seed;
    });

    // Pre-compute display rank for every entry (ties share the same rank number)
    var displayRanks = [];
    var rank = 1;
    for (var i = 0; i < ranked.length; i++) {
        if (i > 0 && ranked[i].pts !== ranked[i - 1].pts) rank = i + 1;
        displayRanks.push(rank);
    }

    /**
     * Builds the HTML string for one half-table covering ranked[start..end).
     */
    function buildHalfTable(start, end) {
        var rows = '';
        for (var j = start; j < end; j++) {
            var r   = displayRanks[j];
            var m   = ranked[j].m;
            var pts = ranked[j].pts;

            var rowClass = (r === 1) ? ' class="rank-1"'
                         : (r === 2) ? ' class="rank-2"'
                         : (r === 3) ? ' class="rank-3"'
                         : '';
            // Medal unicode: gold U+1F947, silver U+1F948, bronze U+1F949
            var medal = (r === 1) ? '<span class="rank-medal">&#x1F947;</span>'
                      : (r === 2) ? '<span class="rank-medal">&#x1F948;</span>'
                      : (r === 3) ? '<span class="rank-medal">&#x1F949;</span>'
                      : '';

            rows += '<tr' + rowClass + '>'
                  + '<td class="col-rank">' + r + medal + '</td>'
                  + '<td class="col-seed">' + escapeHtml(m.group) + '-' + m.seed + '</td>'
                  + '<td class="col-desc">' + escapeHtml(m.short_desc || '') + '</td>'
                  + '<td class="col-pts"><span class="pts-badge">' + pts + '</span></td>'
                  + '</tr>';
        }
        // Wrap table in .table-shell so border/border-radius work correctly
        // under border-collapse:collapse (table's own border is ignored by browsers)
        return '<div class="table-shell">'
             + '<table class="results-table">'
             + '<thead><tr>'
             + '<th class="col-rank">Rank</th>'
             + '<th class="col-seed">Seed</th>'
             + '<th class="col-desc">Midrash</th>'
             + '<th class="col-pts">Pts</th>'
             + '</tr></thead>'
             + '<tbody>' + rows + '</tbody>'
             + '</table>'
             + '</div>';
    }

    // Wrap both half-tables in a flex row; CSS handles stacking on narrow screens
    wrapper.innerHTML = '<div id="tables-row">'
                      + buildHalfTable(0, 32)
                      + buildHalfTable(32, 64)
                      + '</div>';
}


// ─── Bracket rendering ────────────────────────────────────────────────────────

/**
 * Creates a positioned overlay div. Read-only version — no click handlers.
 *
 * For normal matchups: two flex rows (top seed / bottom seed), matching
 * bracketPage.js exactly — same class names, same structure.
 *
 * For random tiebreak matchups: same two seed rows PLUS a third caption row
 * at the bottom reading "random selection tiebreak", and a yellow highlight.
 *
 * @param {object} o  { left, top, width, height, labelA, labelB, winnerId, mA, mB, isRandom }
 */
function makeOverlay(o) {
    const div = document.createElement('div');
    div.className = 'bracket-overlay';
    div.style.cssText = `left:${o.left}%;top:${o.top}%;width:${o.width}%;height:${o.height}%;`;

    // Top seed row — always uses the clean label (no "(random)" text pollution)
    const rowA = document.createElement('div');
    rowA.className = 'overlay-seed-row overlay-seed-top';
    rowA.textContent = o.labelA ?? '';

    // Bottom seed row
    const rowB = document.createElement('div');
    rowB.className = 'overlay-seed-row overlay-seed-bot';
    rowB.textContent = o.labelB ?? '';

    if (o.isRandom) {
        div.classList.add('overlay-random');
        // Still highlight the winner row in yellow-bold so it's clear who won
        if (o.mA && o.mA.midrash_id === o.winnerId) rowA.classList.add('overlay-random-winner-row');
        if (o.mB && o.mB.midrash_id === o.winnerId) rowB.classList.add('overlay-random-winner-row');

        div.appendChild(rowA);
        div.appendChild(rowB);

        // Third caption row — small italic note at the bottom of the box
        const caption = document.createElement('div');
        caption.className = 'overlay-random-caption';
        caption.textContent = 'random selection tiebreak';
        div.appendChild(caption);

    } else {
        if (o.winnerId != null) {
            div.classList.add('overlay-decided');
            if (o.mA && o.mA.midrash_id === o.winnerId) rowA.classList.add('overlay-winner-row');
            if (o.mB && o.mB.midrash_id === o.winnerId) rowB.classList.add('overlay-winner-row');
        } else {
            div.classList.add('overlay-empty');
        }

        div.appendChild(rowA);
        div.appendChild(rowB);
    }

    return div;
}

function renderBracket() {
    const stage = el('bracket-stage');
    if (!stage) return;

    stage.querySelectorAll('.bracket-overlay').forEach(d => d.remove());
    el('bracket-img').style.height = requiredImageHeight() + 'px';

    // ── ROUND 1 ──────────────────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col   = gi < 2 ? COL.L_R1 : COL.R_R1;
        const gName = GROUP_NAMES[gi];

        for (let li = 0; li < 8; li++) {
            const globalIdx = gi * 8 + li;
            const yIdx = (gi % 2) * 8 + li;
            const [ytop, , ybot] = R1_Y[yIdx];
            const [mA, mB] = getContestants(1, globalIdx);
            const winnerId = bracketWinners[1][globalIdx];
            const key = `r1-${globalIdx}`;

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA:   mA ? `${gName}-${mA.seed}` : '',
                labelB:   mB ? `${gName}-${mB.seed}` : '',
                winnerId, mA, mB,
                isRandom: randomTiebreaks.has(key),
            }));
        }
    }

    // ── ROUND 2 ──────────────────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col = gi < 2 ? COL.L_R2 : COL.R_R2;

        for (let li = 0; li < 4; li++) {
            const globalIdx = gi * 4 + li;
            const yIdx = (gi % 2) * 4 + li;
            const [ytop, , ybot] = R2_Y[yIdx];
            const [mA, mB] = getContestants(2, globalIdx);
            const winnerId = bracketWinners[2][globalIdx];
            const key = `r2-${globalIdx}`;

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA:   mA ? `${mA.group}-${mA.seed}` : '',
                labelB:   mB ? `${mB.group}-${mB.seed}` : '',
                winnerId, mA, mB,
                isRandom: randomTiebreaks.has(key),
            }));
        }
    }

    // ── ROUND 3 ──────────────────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col = gi < 2 ? COL.L_R3 : COL.R_R3;

        for (let li = 0; li < 2; li++) {
            const globalIdx = gi * 2 + li;
            const yIdx = (gi % 2) * 2 + li;
            const [ytop, , ybot] = R3_Y[yIdx];
            const [mA, mB] = getContestants(3, globalIdx);
            const winnerId = bracketWinners[3][globalIdx];
            const key = `r3-${globalIdx}`;

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA:   mA ? `${mA.group}-${mA.seed}` : '',
                labelB:   mB ? `${mB.group}-${mB.seed}` : '',
                winnerId, mA, mB,
                isRandom: randomTiebreaks.has(key),
            }));
        }
    }

    // ── ROUND 4 (group finals) ────────────────────────────────────────────────
    for (let gi = 0; gi < 4; gi++) {
        const col  = gi < 2 ? COL.L_R4 : COL.R_R4;
        const yIdx = gi % 2;
        const [ytop, , ybot] = R4_Y[yIdx];
        const [mA, mB] = getContestants(4, gi);
        const winnerId = bracketWinners[4][gi];
        const key = `r4-${gi}`;

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA:   mA ? `${mA.group}-${mA.seed}` : '',
            labelB:   mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
            isRandom: randomTiebreaks.has(key),
        }));
    }

    // ── ROUND 5 (semi-finals) ─────────────────────────────────────────────────
    for (let i = 0; i < 2; i++) {
        const col = i === 0 ? COL.L_SEMI : COL.R_SEMI;
        const [ytop, , ybot] = SEMI_Y;
        const [mA, mB] = getContestants(5, i);
        const winnerId = bracketWinners[5][i];
        const key = `r5-${i}`;

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA:   mA ? `${mA.group}-${mA.seed}` : '',
            labelB:   mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
            isRandom: randomTiebreaks.has(key),
        }));
    }

    // ── ROUND 6 (final) ──────────────────────────────────────────────────────
    {
        const [ytop, , ybot] = FINAL_Y;
        const [mA, mB] = getContestants(6, 0);
        const winnerId = bracketWinners[6][0];
        const key = `r6-0`;

        stage.appendChild(makeOverlay({
            left: COL.CHAMP[0], top: ytop, width: COL.CHAMP[1], height: ybot - ytop,
            labelA:   mA ? `${mA.group}-${mA.seed}` : '',
            labelB:   mB ? `${mB.group}-${mB.seed}` : '',
            winnerId, mA, mB,
            isRandom: randomTiebreaks.has(key),
        }));
    }

    // ── CHAMPION DISPLAY BOX ─────────────────────────────────────────────────
    {
        const champId = bracketWinners[6][0];
        const champ   = midrashById(champId);
        const div = document.createElement('div');
        div.className = 'bracket-overlay bracket-overlay-champ';
        div.style.cssText = `left:${COL.CHAMP[0]}%;top:${CHAMP_BOX_Y[0]}%;width:${COL.CHAMP[1]}%;height:${CHAMP_BOX_Y[1] - CHAMP_BOX_Y[0]}%;`;
        if (champ) {
            const row = document.createElement('div');
            row.className = 'overlay-seed-row overlay-champ-label';
            row.textContent = `${champ.group}-${champ.seed}`;
            div.appendChild(row);
        }
        stage.appendChild(div);
    }

    // ── TIEBREAK FOOTNOTE ─────────────────────────────────────────────────────
    const note = el('tiebreak-note');
    if (randomTiebreaks.size > 0) {
        const matchupList = [...randomTiebreaks].map(k => {
            const [rPart, idxPart] = k.split('-');
            const roundNum = parseInt(rPart.replace('r', ''), 10);
            const idx = parseInt(idxPart, 10);
            return `Round ${roundNum}, matchup #${idx + 1}`;
        }).join('; ');
        el('tiebreak-note-text').textContent =
            `* The following matchup(s) were decided by random tiebreak because both competitors were perfectly even on all tiebreakers: ${matchupList}.`;
        note.style.display = 'block';
    } else {
        note.style.display = 'none';
    }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

/**
 * Fetches midrash list and point totals in parallel, then renders everything.
 */
async function loadResults() {
    // Reset loading state
    el('table-wrapper').innerHTML  = '<div id="table-loading">Loading results\u2026</div>';
    el('bracket-wrapper').innerHTML = `
        <div id="bracket-loading">Loading bracket\u2026</div>`;
    el('tiebreak-note').style.display = 'none';

    // Reset bracket state so a manual refresh starts clean
    bracketWinners = {
        1: new Array(32).fill(null),
        2: new Array(16).fill(null),
        3: new Array(8).fill(null),
        4: new Array(4).fill(null),
        5: new Array(2).fill(null),
        6: new Array(1).fill(null),
    };

    try {
        const [midrashResp, pointsResp] = await Promise.all([
            fetch('/api/bracket/midrashim'),
            fetch('/api/results/points'),
        ]);

        if (!midrashResp.ok) throw new Error(`Midrashim fetch failed (${midrashResp.status})`);
        if (!pointsResp.ok) throw new Error(`Points fetch failed (${pointsResp.status})`);

        const midrashData = await midrashResp.json();
        const pointsData  = await pointsResp.json();  // Array of { midrash_id, total, r1..r6, max_round }

        if (!Array.isArray(midrashData) || midrashData.length !== 64) {
            throw new Error(`Expected 64 midrashim, got ${Array.isArray(midrashData) ? midrashData.length : typeof midrashData}`);
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
            if (groups[g].length !== 16) throw new Error(`Group ${g} has ${groups[g].length} entries (expected 16)`);
        });

        // Build pointMap
        pointMap = {};
        pointsData.forEach(row => {
            pointMap[row.midrash_id] = {
                total:    row.total    ?? 0,
                byRound: {
                    1: row.r1 ?? 0,
                    2: row.r2 ?? 0,
                    3: row.r3 ?? 0,
                    4: row.r4 ?? 0,
                    5: row.r5 ?? 0,
                    6: row.r6 ?? 0,
                },
                maxRound: row.max_round ?? 0,
            };
        });

        // Section 1 — table
        renderTable();

        // Section 2 — bracket
        computeBracket();

        const wrapper = el('bracket-wrapper');
        wrapper.innerHTML = `
            <div id="bracket-stage">
                <img id="bracket-img" src="bracketImage.png" alt="People's Bracket" draggable="false" />
            </div>`;
        if (!resizeListenerAttached) {
            window.addEventListener('resize', renderBracket);
            resizeListenerAttached = true;
        }
        renderBracket();

        // Update timestamp
        el('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (err) {
        el('table-wrapper').innerHTML =
            `<div class="results-error">Failed to load results: ${escapeHtml(err.message)}<br>Please refresh or contact an administrator.</div>`;
        el('bracket-wrapper').innerHTML = '';
    }
}

// ─── Ripple ───────────────────────────────────────────────────────────────────

function attachRipple(container) {
    container.querySelectorAll('.ripple').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const r = this.getBoundingClientRect();
            const c = document.createElement('span');
            c.className = 'circle';
            c.style.top  = (e.clientY - r.top) + 'px';
            c.style.left = (e.clientX - r.left) + 'px';
            this.appendChild(c);
            setTimeout(() => c.remove(), 500);
        });
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Nav scroll (matches bracketPage.js pattern)
    const nav = document.querySelector('nav');
    nav.classList.remove('active');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('active', window.scrollY > nav.offsetHeight + 5);
    });

    // Refresh button
    el('refresh-btn').addEventListener('click', loadResults);
    attachRipple(document.body);

    loadResults();
});