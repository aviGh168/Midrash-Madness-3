/**
 * bracketPage.js  —  Midrash Madness Bracket
 *
 * The bracket is displayed as a PNG image (bracketImage.png).
 * Transparent overlay <div>s are absolutely positioned over every matchup box,
 * sized in percentage units so they scale with the image.
 *
 * The image width = 100% of its container.
 * The image HEIGHT is set by JS so that the shortest seed box is at least
 * MIN_BOX_PX pixels tall — enough to show a readable text label.
 *
 * PDF native size: 4800 × 3750 px  (aspect ratio 1.28 : 1 wide)
 * All positions below are expressed as % of those native dimensions.
 *
 * Round logic:
 *   R1  32 matchups  (8 per group A-D)
 *   R2  16 matchups  (4 per group)
 *   R3   8 matchups  (2 per group)
 *   R4   4 matchups  (1 per group — group champion)
 *   R5   2 matchups  (semi-finals: A-champ vs B-champ, C-champ vs D-champ)
 *   R6   1 matchup   (final)
 *
 * PDF visual columns:
 *   L-R1  → JS R1  (groups A+B, left side)
 *   L-R2  → JS R2  (groups A+B)
 *   L-R3  → JS R3  (groups A+B)
 *   L-R4  → JS R5 semi-final LEFT  (A-champ vs B-champ)
 *   CENTER → JS R6 final
 *   R-R4  → JS R5 semi-final RIGHT (C-champ vs D-champ)
 *   R-R3  → JS R3  (groups C+D)
 *   R-R2  → JS R2  (groups C+D)
 *   R-R1  → JS R1  (groups C+D, right side)
 *
 * JS R4 (group finals) has no dedicated PDF column.
 * While currentRound === 4, we re-use the R3 column space with a subtle
 * "round 4" overlay to let users pick the group champions before semi-finals.
 */

// ─── Layout constants ─────────────────────────────────────────────────────────

/** Minimum height in px for the smallest seed box on screen. */
const MIN_BOX_PX = 38;

/**
 * Column x-positions as [left%, width%] of the PDF native width (4800 px).
 * Empirically measured from bracketImage.png pixel analysis.
 *
 * PDF column layout (left → right):
 *   L_R1   cols  70- 558  → JS Round 1  (Groups A+B)
 *   L_R2   cols 590-1077  → JS Round 2  (Groups A+B)
 *   L_R3   cols 832-1320  → JS Round 3  (Groups A+B)  [overlaps R2 x-range]
 *   L_R4   cols 1198-1686 → JS Round 4  (group finals A+B)
 *   L_SEMI cols 1523-2011 → JS Round 5  (semi-final, left)
 *   CHAMP  cols 2161-2648 → JS Round 6  (final / champion)
 *   Right side mirrors left exactly.
 */
const COL = {
    L_R1:   [1.46,  10.17],  // cols  70-558
    L_R2:   [12.29, 10.15],  // cols 590-1077
    L_R3:   [17.33, 10.17],  // cols 832-1320
    L_R4:   [24.96, 10.17],  // cols 1198-1686
    L_SEMI: [31.73, 10.17],  // cols 1523-2011
    CHAMP:  [45.02, 10.15],  // cols 2161-2648
    R_SEMI: [58.10, 10.17],  // cols 2789-3277
    R_R4:   [64.88, 10.17],  // cols 3114-3602
    R_R3:   [72.50, 10.17],  // cols 3480-3968
    R_R2:   [77.52, 10.15],  // cols 3721-4208
    R_R1:   [88.33, 10.15],  // cols 4240-4727
};

/**
 * R1 matchup y-positions as [topY%, midY%, botY%] of PDF native height (3750 px).
 * 16 entries — one per matchup. Both sides (left A+B, right C+D) use the same y values.
 * Groups A and C occupy matchups 0-7 (top half); B and D occupy matchups 8-15 (bottom half).
 *
 * Structure: each matchup box = seed1_box + [1-2px double-line border] + seed2_box,
 * separated from the next matchup by a ~79px spacer row.
 * topY = top of seed1 box, midY = dividing line, botY = bottom of seed2 box.
 */
const R1_Y = [
    [ 1.87,  3.89,  5.92],  // matchup 0  rows  70-222
    [ 8.03, 10.04, 12.05],  // matchup 1  rows 301-452
    [14.16, 16.17, 18.21],  // matchup 2  rows 531-683
    [20.29, 22.31, 24.35],  // matchup 3  rows 761-913
    [26.45, 28.47, 30.48],  // matchup 4  rows 992-1143
    [32.59, 34.60, 36.64],  // matchup 5  rows 1222-1374
    [38.72, 40.73, 42.77],  // matchup 6  rows 1452-1604
    [44.88, 46.89, 48.91],  // matchup 7  rows 1683-1834
    [51.01, 53.03, 55.07],  // matchup 8  rows 1913-2065
    [57.15, 59.16, 61.20],  // matchup 9  rows 2143-2295
    [63.31, 65.32, 67.33],  // matchup 10 rows 2374-2525
    [69.44, 71.45, 73.49],  // matchup 11 rows 2604-2756
    [75.57, 77.59, 79.63],  // matchup 12 rows 2834-2986
    [81.71, 83.72, 85.76],  // matchup 13 rows 3064-3216
    [87.87, 89.88, 91.92],  // matchup 14 rows 3295-3447
    [94.00, 96.01, 98.05],  // matchup 15 rows 3525-3677
];

/**
 * R2 matchup y-positions. 8 entries (4 per group-side).
 * Indices 0-3 = Groups A/C (top half); 4-7 = Groups B/D (bottom half).
 */
const R2_Y = [
    [ 5.01,  7.04,  9.07],  // rows 188-340
    [17.31, 19.33, 21.36],  // rows 649-801
    [29.60, 31.63, 33.65],  // rows 1110-1262
    [41.87, 43.89, 45.92],  // rows 1570-1722
    [54.16, 56.19, 58.21],  // rows 2031-2183
    [66.45, 68.45, 70.48],  // rows 2492-2643
    [78.72, 80.75, 82.77],  // rows 2952-3104
    [91.01, 93.04, 95.07],  // rows 3413-3565
];

/**
 * R3 matchup y-positions. 4 entries (2 per group-side).
 * Indices 0-1 = Groups A/C; 2-3 = Groups B/D.
 */
const R3_Y = [
    [11.01, 13.04, 15.07],  // rows 413-565   (Group A/C, R3 matchup 1)
    [35.57, 37.60, 39.63],  // rows 1334-1486 (Group A/C, R3 matchup 2)
    [60.13, 62.16, 64.19],  // rows 2255-2407 (Group B/D, R3 matchup 1)
    [84.72, 86.75, 88.77],  // rows 3177-3329 (Group B/D, R3 matchup 2)
];

/**
 * R4 (group final) y-positions. 2 entries per side.
 * Index 0 = Groups A/C (top half); index 1 = Groups B/D (bottom half).
 */
const R4_Y = [
    [23.31, 25.32, 27.33],  // rows 874-1025
    [72.43, 74.45, 76.48],  // rows 2716-2868
];

/**
 * Semi-final (JS R5) y-position — one matchup per side.
 * Left side: A-champ vs B-champ (L_SEMI column).
 * Right side: C-champ vs D-champ (R_SEMI column).
 */
const SEMI_Y = [47.87, 49.89, 51.92];  // rows 1795-1947

/**
 * Final (JS R6) y-position — CHAMP column center.
 */
const FINAL_Y = [47.87, 49.89, 51.92];  // rows 1795-1947 (same box area as semi)

/**
 * Champion display box — the single box directly below the final matchup.
 * [topY%, botY%]  rows 2025-2100
 */
const CHAMP_BOX_Y = [54.00, 56.00];

// ─── State ────────────────────────────────────────────────────────────────────

let allMidrashim = [];
let groups = {};               // { A:[...16], B:[...16], C:[...16], D:[...16] }
let currentRound = 1;
const TOTAL_ROUNDS = 6;

let winners = {
    1: new Array(32).fill(null),
    2: new Array(16).fill(null),
    3: new Array(8).fill(null),
    4: new Array(4).fill(null),
    5: new Array(2).fill(null),
    6: new Array(1).fill(null),
};

let activeMatchup = null;  // { round, index, idA, idB, pendingPick }

// ─── Seeding ──────────────────────────────────────────────────────────────────

const GROUP_NAMES = ['A', 'B', 'C', 'D'];

/**
 * Standard bracket seed pairing for 16-seed group, visual top-to-bottom order.
 * [seedIndex0, seedIndex1] where index 0 = seed 1 (0-indexed).
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
            midrashById(winners[round - 1][prevOff + localIdx * 2]),
            midrashById(winners[round - 1][prevOff + localIdx * 2 + 1]),
        ];
    }
    if (round === 5) {
        if (globalIdx === 0) return [midrashById(winners[4][0]), midrashById(winners[4][1])];
        return [midrashById(winners[4][2]), midrashById(winners[4][3])];
    }
    if (round === 6) {
        return [midrashById(winners[5][0]), midrashById(winners[5][1])];
    }
    return [null, null];
}

function midrashById(id) {
    if (id == null) return null;
    return allMidrashim.find(m => m.midrash_id === id) ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Image height ─────────────────────────────────────────────────────────────

/**
 * Returns the px height the bracket image should be set to, so that the
 * smallest R1 seed box is at least MIN_BOX_PX tall.
 *
 * Smallest seed box = shortest (topY → midY) or (midY → botY) across R1_Y.
 * That fraction of the total image height must be >= MIN_BOX_PX.
 */
function requiredImageHeight() {
    let minFrac = Infinity;
    for (const [t, m, b] of R1_Y) {
        minFrac = Math.min(minFrac, (m - t) / 100, (b - m) / 100);
    }
    return Math.ceil(MIN_BOX_PX / minFrac);
}

// ─── Overlay factory ──────────────────────────────────────────────────────────

/**
 * Build a positioned overlay div for one matchup.
 * @param {object} o
 *   left, top, width, height — all in % of stage dimensions
 *   labelA, labelB — text for top and bottom seed rows
 *   clickable — whether to attach click handler
 *   decided   — whether winner already chosen
 *   winnerId, idA, idB — for highlighting winner row
 *   round, globalIdx, mA, mB — for click handler
 */
function makeOverlay(o) {
    const div = document.createElement('div');
    div.className = 'bracket-overlay';
    div.style.cssText =
        `left:${o.left}%;top:${o.top}%;width:${o.width}%;height:${o.height}%;`;

    const rowA = document.createElement('div');
    rowA.className = 'overlay-seed-row overlay-seed-top';
    rowA.textContent = o.labelA;

    const rowB = document.createElement('div');
    rowB.className = 'overlay-seed-row overlay-seed-bot';
    rowB.textContent = o.labelB;

    div.appendChild(rowA);
    div.appendChild(rowB);

    if (o.decided) {
        div.classList.add('overlay-decided');
        if (o.mA && o.mA.midrash_id === o.winnerId) rowA.classList.add('overlay-winner-row');
        if (o.mB && o.mB.midrash_id === o.winnerId) rowB.classList.add('overlay-winner-row');
    }

    if (o.clickable) {
        div.classList.add('overlay-clickable');
        div.setAttribute('role', 'button');
        div.setAttribute('tabindex', '0');
        const open = () => openMatchupModal(o.round, o.globalIdx, o.mA, o.mB);
        div.addEventListener('click', open);
        div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    } else {
        div.classList.add('overlay-locked');
    }

    return div;
}

// ─── Main render ──────────────────────────────────────────────────────────────

function renderBracket() {
    const stage = el('bracket-stage');
    if (!stage) return;

    // Remove old overlays
    stage.querySelectorAll('.bracket-overlay').forEach(d => d.remove());

    // Set image height so every seed box is at least MIN_BOX_PX tall
    el('bracket-img').style.height = requiredImageHeight() + 'px';

    // ── ROUND 1 ──────────────────────────────────────────────────────────────
    // R1_Y has 16 entries (one per matchup slot).
    // Groups A and C use indices 0-7 (top half of image).
    // Groups B and D use indices 8-15 (bottom half of image).
    // Groups A+B → left column (L_R1); Groups C+D → right column (R_R1).
    for (let gi = 0; gi < 4; gi++) {
        const col   = gi < 2 ? COL.L_R1 : COL.R_R1;
        const gName = GROUP_NAMES[gi];

        for (let li = 0; li < 8; li++) {
            const globalIdx = gi * 8 + li;
            // gi 0 (A): yIdx 0-7; gi 1 (B): yIdx 8-15; gi 2 (C): 0-7; gi 3 (D): 8-15
            const yIdx = (gi % 2) * 8 + li;
            const [ytop, , ybot] = R1_Y[yIdx];
            const [mA, mB] = getContestants(1, globalIdx);
            const winnerId = winners[1][globalIdx];

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA:    mA ? `${gName}-${mA.seed}` : '',
                labelB:    mB ? `${gName}-${mB.seed}` : '',
                clickable: currentRound === 1 && !!mA && !!mB,
                decided:   winnerId != null,
                winnerId, mA, mB, round: 1, globalIdx,
            }));
        }
    }

    // ── ROUND 2 ──────────────────────────────────────────────────────────────
    // R2_Y has 8 entries.
    // Groups A and C use indices 0-3; Groups B and D use indices 4-7.
    // Groups A+B → L_R2; Groups C+D → R_R2.
    for (let gi = 0; gi < 4; gi++) {
        const col = gi < 2 ? COL.L_R2 : COL.R_R2;

        for (let li = 0; li < 4; li++) {
            const globalIdx = gi * 4 + li;
            const yIdx = (gi % 2) * 4 + li;
            const [ytop, , ybot] = R2_Y[yIdx];
            const [mA, mB] = getContestants(2, globalIdx);
            const winnerId = winners[2][globalIdx];

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA:    mA ? `${mA.group}-${mA.seed}` : '',
                labelB:    mB ? `${mB.group}-${mB.seed}` : '',
                clickable: currentRound === 2 && !!mA && !!mB,
                decided:   winnerId != null,
                winnerId, mA, mB, round: 2, globalIdx,
            }));
        }
    }

    // ── ROUND 3 ──────────────────────────────────────────────────────────────
    // R3_Y has 4 entries.
    // Groups A and C use indices 0-1; Groups B and D use indices 2-3.
    // Groups A+B → L_R3; Groups C+D → R_R3.
    for (let gi = 0; gi < 4; gi++) {
        const col = gi < 2 ? COL.L_R3 : COL.R_R3;

        for (let li = 0; li < 2; li++) {
            const globalIdx = gi * 2 + li;
            const yIdx = (gi % 2) * 2 + li;
            const [ytop, , ybot] = R3_Y[yIdx];
            const [mA, mB] = getContestants(3, globalIdx);
            const winnerId = winners[3][globalIdx];

            stage.appendChild(makeOverlay({
                left: col[0], top: ytop, width: col[1], height: ybot - ytop,
                labelA:    mA ? `${mA.group}-${mA.seed}` : '',
                labelB:    mB ? `${mB.group}-${mB.seed}` : '',
                clickable: currentRound === 3 && !!mA && !!mB,
                decided:   winnerId != null,
                winnerId, mA, mB, round: 3, globalIdx,
            }));
        }
    }

    // ── ROUND 4 (group finals) ────────────────────────────────────────────────
    // R4_Y has 2 entries (one per half of image).
    // Groups A and C use index 0; Groups B and D use index 1.
    // Groups A+B → L_R4; Groups C+D → R_R4.
    for (let gi = 0; gi < 4; gi++) {
        const col  = gi < 2 ? COL.L_R4 : COL.R_R4;
        const yIdx = gi % 2;   // 0 for A/C, 1 for B/D
        const [ytop, , ybot] = R4_Y[yIdx];
        const [mA, mB] = getContestants(4, gi);
        const winnerId = winners[4][gi];

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA:    mA ? `${mA.group}-${mA.seed}` : '',
            labelB:    mB ? `${mB.group}-${mB.seed}` : '',
            clickable: currentRound === 4 && !!mA && !!mB,
            decided:   winnerId != null,
            winnerId, mA, mB, round: 4, globalIdx: gi,
        }));
    }

    // ── ROUND 5 (semi-finals) ─────────────────────────────────────────────────
    // Left semi (A-champ vs B-champ) → L_SEMI; right semi (C-champ vs D-champ) → R_SEMI.
    for (let i = 0; i < 2; i++) {
        const col = i === 0 ? COL.L_SEMI : COL.R_SEMI;
        const [ytop, , ybot] = SEMI_Y;
        const [mA, mB] = getContestants(5, i);
        const winnerId = winners[5][i];

        stage.appendChild(makeOverlay({
            left: col[0], top: ytop, width: col[1], height: ybot - ytop,
            labelA:    mA ? `${mA.group}-${mA.seed}` : '',
            labelB:    mB ? `${mB.group}-${mB.seed}` : '',
            clickable: currentRound === 5 && !!mA && !!mB,
            decided:   winnerId != null,
            winnerId, mA, mB, round: 5, globalIdx: i,
        }));
    }

    // ── ROUND 6 (final) ──────────────────────────────────────────────────────
    {
        const [ytop, , ybot] = FINAL_Y;
        const [mA, mB] = getContestants(6, 0);
        const winnerId = winners[6][0];

        stage.appendChild(makeOverlay({
            left: COL.CHAMP[0], top: ytop, width: COL.CHAMP[1], height: ybot - ytop,
            labelA:    mA ? `${mA.group}-${mA.seed}` : '',
            labelB:    mB ? `${mB.group}-${mB.seed}` : '',
            clickable: currentRound === 6 && !!mA && !!mB,
            decided:   winnerId != null,
            winnerId, mA, mB, round: 6, globalIdx: 0,
        }));
    }

    // ── CHAMPION DISPLAY BOX ─────────────────────────────────────────────────
    // Single box below the final matchup — shows the ultimate winner.
    {
        const champId = winners[6][0];
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

    updateControls();
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function updateControls() {
    el('round-label').textContent = `Round ${currentRound} of ${TOTAL_ROUNDS}`;
    const backBtn     = el('back-btn');
    const advBtn      = el('advance-btn');
    const progressEl  = el('progress-counter');
    const submitInline = el('submit-inline-btn');

    backBtn.style.display = currentRound > 1 ? 'inline-block' : 'none';

    const total = winners[currentRound].length;
    const chosen = winners[currentRound].filter(w => w != null).length;
    const done = chosen === total;

    // Round 6 complete → show Submit button in controls bar
    if (currentRound === TOTAL_ROUNDS && done) {
        advBtn.style.display        = 'none';
        progressEl.style.display    = 'none';
        submitInline.style.display  = 'inline-block';
        return;
    }

    submitInline.style.display = 'none';

    if (done && currentRound < TOTAL_ROUNDS) {
        // All picked for this round → show Advance, hide counter
        advBtn.textContent       = currentRound === 5 ? 'Go to Final \u203a' : 'Advance to Next Round \u203a';
        advBtn.style.display     = 'inline-block';
        progressEl.style.display = 'none';
    } else {
        // Still picking → hide Advance, show progress counter
        advBtn.style.display      = 'none';
        progressEl.textContent    = `${chosen} of ${total} chosen`;
        progressEl.style.display  = 'inline-block';
    }
}

function allWinnersSet(round) {
    return winners[round].every(w => w != null);
}

function advanceRound() {
    if (!allWinnersSet(currentRound) || currentRound >= TOTAL_ROUNDS) return;
    currentRound++;
    renderBracket();
}

function goBack() {
    if (currentRound <= 1) return;
    if (!confirm(`Going back will clear all your picks for Round ${currentRound}. Continue?`)) return;
    winners[currentRound] = new Array(winners[currentRound].length).fill(null);
    currentRound--;
    renderBracket();
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openMatchupModal(round, globalIdx, mA, mB) {
    if (round !== currentRound) return;
    const existing = winners[round][globalIdx] ?? null;
    activeMatchup  = { round, index: globalIdx, idA: mA.midrash_id, idB: mB.midrash_id, pendingPick: existing };

    el('seed-a').textContent   = `${mA.group} \u2014 Seed ${mA.seed}`;
    el('desc-a').textContent   = mA.long_desc || mA.short_desc || '';
    el('source-a').textContent = mA.source ? `Source: ${mA.source}` : '';

    el('seed-b').textContent   = `${mB.group} \u2014 Seed ${mB.seed}`;
    el('desc-b').textContent   = mB.long_desc || mB.short_desc || '';
    el('source-b').textContent = mB.source ? `Source: ${mB.source}` : '';

    highlightPick(existing, mA.midrash_id, mB.midrash_id);
    updateOkButton();
    el('matchup-modal').style.display = 'flex';
}

function highlightPick(winnerId, idA, idB) {
    const cardA = el('contestant-a'), cardB = el('contestant-b');
    cardA.style.borderColor = winnerId === idA ? 'rgb(39,174,96)' : 'transparent';
    cardB.style.borderColor = winnerId === idB ? 'rgb(39,174,96)' : 'transparent';
    cardA.classList.toggle('selected', winnerId === idA);
    cardB.classList.toggle('selected', winnerId === idB);
    el('pick-a').classList.toggle('pick-btn-selected', winnerId === idA);
    el('pick-b').classList.toggle('pick-btn-selected', winnerId === idB);
}

function updateOkButton() {
    const ok = el('matchup-ok-btn');
    if (!ok) return;
    const has = !!(activeMatchup && activeMatchup.pendingPick != null);
    ok.disabled = !has;
    ok.classList.toggle('ok-btn-ready', has);
}

function closeMatchupModal() {
    el('matchup-modal').style.display = 'none';
    activeMatchup = null;
}

function pickWinner(id) {
    if (!activeMatchup) return;
    activeMatchup.pendingPick = id;
    highlightPick(id, activeMatchup.idA, activeMatchup.idB);
    updateOkButton();
}

function confirmMatchupPick() {
    if (!activeMatchup || activeMatchup.pendingPick == null) return;
    winners[activeMatchup.round][activeMatchup.index] = activeMatchup.pendingPick;
    closeMatchupModal();
    renderBracket();
}

// ─── Submit ───────────────────────────────────────────────────────────────────

function openSubmitModal() {
    // Restore form HTML in case it was replaced by the success message
    const box = el('submit-modal').querySelector('.modal-box');
    if (!el('submit-name')) {
        box.innerHTML = `
            <button class="modal-close" id="submit-modal-close">&times;</button>
            <h2 class="modal-title">Submit Your Bracket</h2>
            <p class="modal-subtitle">Enter your details to be notified of the results!</p>
            <div id="submit-error" class="submit-error" style="display:none;"></div>
            <div class="submit-form">
                <input type="text"  id="submit-name"  placeholder="Your Name"         class="form-input" />
                <input type="email" id="submit-email" placeholder="Your Email Address" class="form-input" />
                <button class="pick-btn ripple" id="submit-confirm-btn">Submit Bracket</button>
            </div>`;
        el('submit-modal-close').addEventListener('click', closeSubmitModal);
        el('submit-confirm-btn').addEventListener('click', submitBracket);
        attachRipple(box);
    }
    el('submit-error').style.display = 'none';
    el('submit-name').value  = '';
    el('submit-email').value = '';
    el('submit-modal').style.display = 'flex';
}

function closeSubmitModal() {
    el('submit-modal').style.display = 'none';
}

async function submitBracket() {
    const name  = el('submit-name').value.trim();
    const email = el('submit-email').value.trim();
    const err   = el('submit-error');

    if (!name || !email) {
        err.textContent = 'Please enter both your name and email address.';
        err.style.display = 'block'; return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.textContent = 'Please enter a valid email address.';
        err.style.display = 'block'; return;
    }
    if (!allWinnersSet(6)) {
        err.textContent = 'Please complete all rounds before submitting.';
        err.style.display = 'block'; return;
    }

    const btn = el('submit-confirm-btn');
    btn.disabled = true; btn.textContent = 'Submitting\u2026';

    try {
        const resp = await fetch('/api/bracket/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, email,
                round1Winners: winners[1], round2Winners: winners[2],
                round3Winners: winners[3], round4Winners: winners[4],
                round5Winners: winners[5], round6Winners: winners[6],
            }),
        });

        if (resp.status === 409) {
            err.textContent = 'This email has already submitted a bracket. Each person may submit once.';
            err.style.display = 'block';
            btn.disabled = false; btn.textContent = 'Submit Bracket'; return;
        }
        if (!resp.ok) throw new Error((await resp.text().catch(() => '')) || 'Server error');

        showSuccessMessage(name);
    } catch(e) {
        err.textContent = `Submission failed: ${e.message}. Please try again.`;
        err.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Submit Bracket';
    }
}

function showSuccessMessage(name) {
    const box = el('submit-modal').querySelector('.modal-box');
    box.innerHTML = `
        <div style="text-align:center;">
            <div style="font-size:40px;margin-bottom:16px;">&#x1F389;</div>
            <h2 class="modal-title">Thank You, ${escapeHtml(name)}!</h2>
            <p class="modal-subtitle">Your bracket has been submitted. You should receive a confirmation email (though it may have been sent to spam). We will notify you when the final results are in, but for now, click below to see how it has been going so far.</p>
            <div class="modal-ok-row">
                <button class="ok-btn ok-btn-ready ripple" onclick="window.location.href='resultsPage.html'">View Current Results</button>
            </div>
        </div>`;
    attachRipple(box);
    el('submit-modal').style.display = 'flex';
}

// ─── Ripple ───────────────────────────────────────────────────────────────────

function attachRipple(container) {
    container.querySelectorAll('.ripple').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const r = this.getBoundingClientRect();
            const c = document.createElement('span');
            c.className = 'circle';
            c.style.top  = (e.clientY - r.top)  + 'px';
            c.style.left = (e.clientX - r.left) + 'px';
            this.appendChild(c);
            setTimeout(() => c.remove(), 500);
        });
    });
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadMidrashim() {
    try {
        const resp = await fetch('/api/bracket/midrashim');
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const data = await resp.json();

        if (!Array.isArray(data) || data.length !== 64)
            throw new Error(`Expected 64 midrashim, got ${Array.isArray(data) ? data.length : typeof data}.`);

        allMidrashim = data;
        groups = { A:[], B:[], C:[], D:[] };
        data.forEach(m => {
            const g = m.group?.toUpperCase();
            if (g && groups[g]) groups[g].push(m);
        });
        ['A','B','C','D'].forEach(g => {
            groups[g].sort((a,b) => a.seed - b.seed);
            if (groups[g].length !== 16)
                throw new Error(`Group ${g} has ${groups[g].length} entries (expected 16).`);
        });

        // Build stage
        const wrapper = el('bracket-wrapper');
        wrapper.innerHTML = `
            <div id="bracket-stage">
                <img id="bracket-img" src="bracketImage.png" alt="Bracket" draggable="false" />
            </div>`;

        window.addEventListener('resize', renderBracket);
        renderBracket();

    } catch(err) {
        el('bracket-wrapper').innerHTML =
            `<div id="bracket-loading" style="color:#a00;">
                Failed to load bracket: ${escapeHtml(err.message)}<br>
                Please refresh or contact an administrator.
             </div>`;
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Nav scroll
    const nav = document.querySelector('nav');
    nav.classList.remove('active');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('active', window.scrollY > nav.offsetHeight + 5);
    });

    // Keep round-controls pinned just below the nav at all times
    function pinControls() {
        el('round-controls').style.top = nav.offsetHeight + 'px';
    }
    pinControls();
    window.addEventListener('resize', pinControls);

    // Controls
    el('back-btn').addEventListener('click', goBack);
    el('advance-btn').addEventListener('click', advanceRound);

    // Matchup modal
    el('modal-close-btn').addEventListener('click', closeMatchupModal);
    el('matchup-modal').addEventListener('click', e => { if (e.target === el('matchup-modal')) closeMatchupModal(); });
    el('pick-a').addEventListener('click', () => { if (activeMatchup) pickWinner(activeMatchup.idA); });
    el('pick-b').addEventListener('click', () => { if (activeMatchup) pickWinner(activeMatchup.idB); });
    el('matchup-ok-btn').addEventListener('click', confirmMatchupPick);

    // Submit modal
    el('submit-modal-close').addEventListener('click', closeSubmitModal);
    el('submit-modal').addEventListener('click', e => { if (e.target === el('submit-modal') && el('submit-name')) closeSubmitModal(); });
    el('submit-confirm-btn').addEventListener('click', submitBracket);
    el('submit-inline-btn').addEventListener('click', openSubmitModal);

    attachRipple(document.body);
    loadMidrashim();
});