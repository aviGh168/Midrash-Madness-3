/**
 * bracketPage.js
 * Handles all bracket UI logic for Midrash Madness.
 *
 * Data flow:
 *  1. On load, fetch all 64 midrashim from GET /api/bracket/midrashim
 *  2. Organise into groups A-D, seeded 1-16 each
 *  3. Generate 4 rounds per group (R1=8 matchups, R2=4, R3=2, R4=1) + semifinal + final
 *  4. Track winners client-side until submission
 *  5. On submit, POST /api/bracket/submit with all round winners + user info
 *
 * Seeding: standard 1v16, 2v15, 3v14, 4v13, 5v12, 6v11, 7v10, 8v9
 * Global round numbering (1-6):
 *   Round 1 - 32 matchups (8 per group)
 *   Round 2 - 16 matchups (4 per group)
 *   Round 3 - 8  matchups (2 per group)
 *   Round 4 - 4  matchups (1 per group)
 *   Round 5 - 2  matchups (semi-finals: A-winner vs B-winner, C vs D)
 *   Round 6 - 1  matchup  (final)
 */

// ─── State ────────────────────────────────────────────────────────────────────

let allMidrashim = [];          // flat array from server
let groups = {};                // { A: [...16], B: [...16], C: [...16], D: [...16] }
let currentRound = 1;           // 1-6
const TOTAL_ROUNDS = 6;

/**
 * winners[round][matchupIndex] = midrash_id of winner (or null)
 * matchupIndex is global across all matchups in that round.
 *
 * Round 1: indices 0-31  (groups A,B,C,D each have 8 matchups)
 * Round 2: indices 0-15
 * Round 3: indices 0-7
 * Round 4: indices 0-3
 * Round 5: indices 0-1
 * Round 6: indices 0
 */
let winners = {
    1: new Array(32).fill(null),
    2: new Array(16).fill(null),
    3: new Array(8).fill(null),
    4: new Array(4).fill(null),
    5: new Array(2).fill(null),
    6: new Array(1).fill(null),
};

// Active matchup being shown in the modal
// pendingPick holds the midrash_id the user has highlighted but not yet confirmed with OK
let activeMatchup = null; // { round, index, idA, idB, pendingPick }

// ─── Group/matchup index helpers ──────────────────────────────────────────────

const GROUP_NAMES = ['A', 'B', 'C', 'D'];

/**
 * Returns the global matchup start index for a group in a given round.
 * Rounds 1-4 have 8/4/2/1 matchups per group.
 * Rounds 5-6 are cross-group.
 */
function groupOffset(groupIndex, round) {
    const matchupsPerGroup = [0, 8, 4, 2, 1][round]; // round 1-4
    return groupIndex * matchupsPerGroup;
}

/**
 * Standard 8-seed bracket matchup pairs (0-indexed seeds 0-15)
 * Returns array of [topSeedIdx, bottomSeedIdx] pairs in visual bracket order.
 */
const SEED_PAIRS_R1 = [
    [0, 15], // 1 vs 16
    [7, 8],  // 8 vs 9
    [4, 11], // 5 vs 12
    [3, 12], // 4 vs 13
    [2, 13], // 3 vs 14
    [5, 10], // 6 vs 11
    [6, 9],  // 7 vs 10
    [1, 14], // 2 vs 15
];

/**
 * Get the two contestants for a matchup at a given round and matchup index
 * (relative to that group's start).
 */
function getContestants(round, globalIdx) {
    if (round === 1) {
        // Determine group
        const groupIdx = Math.floor(globalIdx / 8);
        const localIdx = globalIdx % 8;
        const group = groups[GROUP_NAMES[groupIdx]];
        if (!group) return [null, null];
        const [seedA, seedB] = SEED_PAIRS_R1[localIdx];
        return [group[seedA], group[seedB]];
    }
    if (round >= 2 && round <= 4) {
        const matchupsPerGroup = [0, 0, 4, 2, 1][round];
        const groupIdx = Math.floor(globalIdx / matchupsPerGroup);
        const localIdx = globalIdx % matchupsPerGroup;
        // Each matchup pulls from the previous round's two relevant winners
        const prevMatchupsPerGroup = [0, 8, 4, 2, 1][round - 1];
        const prevOffset = groupIdx * prevMatchupsPerGroup;
        // In bracket order, local matchup i in this round comes from prev matchups 2i and 2i+1
        const prevIdxA = prevOffset + localIdx * 2;
        const prevIdxB = prevOffset + localIdx * 2 + 1;
        return [
            midrashById(winners[round - 1][prevIdxA]),
            midrashById(winners[round - 1][prevIdxB]),
        ];
    }
    if (round === 5) {
        // Semi-finals: winner of group A (idx 0 in round4) vs winner of group B (idx 1)
        //              winner of group C (idx 2) vs winner of group D (idx 3)
        if (globalIdx === 0) {
            return [midrashById(winners[4][0]), midrashById(winners[4][1])];
        } else {
            return [midrashById(winners[4][2]), midrashById(winners[4][3])];
        }
    }
    if (round === 6) {
        return [midrashById(winners[5][0]), midrashById(winners[5][1])];
    }
    return [null, null];
}

function midrashById(id) {
    if (id === null || id === undefined) return null;
    return allMidrashim.find(m => m.midrash_id === id) || null;
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function makeSeedBox(labelText, midrash, round, globalIdx, clickable) {
    const div = document.createElement('div');
    div.className = 'seed-box';

    if (!midrash) {
        div.classList.add('tbd');
        div.textContent = 'TBD';
        return div;
    }

    div.textContent = labelText;

    const winnerId = winners[round] ? winners[round][globalIdx] : null;
    const isWinner = (winnerId !== null && winnerId !== undefined);

    if (round < currentRound) {
        div.classList.add('locked');
    } else if (clickable && round === currentRound) {
        div.classList.add('clickable');
    }

    if (isWinner) div.classList.add('winner');

    return div;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderBracket() {
    // Re-render all four group divs
    ['A', 'B', 'C', 'D'].forEach((g, gi) => {
        renderGroup(g, gi);
    });

    // Round 5 & 6 are shown in champion area / separate section if needed
    renderCrossRounds();

    updateControls();
    updateChampion();
}

function renderGroup(groupName, groupIndex) {
    const container = el(`group-${groupName.toLowerCase()}`);
    container.innerHTML = '';

    const innerFlex = document.createElement('div');
    innerFlex.style.display = 'flex';
    innerFlex.style.flexDirection = 'row';
    innerFlex.style.alignItems = 'stretch';

    // Build round-1 column wrapped with the group label above it
    const r1Wrapper = document.createElement('div');
    r1Wrapper.style.display = 'flex';
    r1Wrapper.style.flexDirection = 'column';

    const label = document.createElement('div');
    label.className = 'group-label';
    label.textContent = `Group ${groupName}`;
    r1Wrapper.appendChild(label);

    const r1Col = document.createElement('div');
    r1Col.className = 'round-col';
    r1Col.dataset.round = 1;
    const r1Matchups = 8;
    const r1Offset = groupOffset(groupIndex, 1);
    for (let mi = 0; mi < r1Matchups; mi++) {
        r1Col.appendChild(buildMatchupSlot(1, r1Offset + mi, groupName));
    }
    r1Wrapper.appendChild(r1Col);
    innerFlex.appendChild(r1Wrapper);

    // Rounds 2-4 as plain columns
    for (let r = 2; r <= 4; r++) {
        const col = document.createElement('div');
        col.className = 'round-col';
        col.dataset.round = r;

        const matchupsInRound = [0, 0, 4, 2, 1][r];
        const offset = groupOffset(groupIndex, r);

        for (let mi = 0; mi < matchupsInRound; mi++) {
            col.appendChild(buildMatchupSlot(r, offset + mi, groupName));
        }

        innerFlex.appendChild(col);
    }

    container.appendChild(innerFlex);
}

function buildMatchupSlot(round, globalIdx, groupName) {
    const [mA, mB] = getContestants(round, globalIdx);
    const slot = document.createElement('div');
    slot.className = 'matchup-slot';

    // The entire matchup-pair is the single clickable card unit
    const pair = document.createElement('div');
    pair.className = 'matchup-pair';

    const labelA = mA ? `${groupName} - ${mA.seed}` : 'TBD';
    const labelB = mB ? `${groupName} - ${mB.seed}` : 'TBD';

    // Boxes are display-only — no individual click handlers
    const boxA = makeSeedBox(labelA, mA, round, globalIdx, false);
    const boxB = makeSeedBox(labelB, mB, round, globalIdx, false);

    // Highlight the winner box
    const winnerId = winners[round][globalIdx];
    if (winnerId !== null && winnerId !== undefined) {
        if (mA && mA.midrash_id === winnerId) boxA.classList.add('winner');
        if (mB && mB.midrash_id === winnerId) boxB.classList.add('winner');
    }

    const canClick = (round === currentRound) && mA && mB;
    if (canClick) {
        // The whole pair card is the clickable unit
        pair.classList.add('matchup-card-clickable');
        pair.setAttribute('role', 'button');
        pair.setAttribute('tabindex', '0');
        pair.addEventListener('click', () => openMatchupModal(round, globalIdx, mA, mB));
        pair.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') openMatchupModal(round, globalIdx, mA, mB);
        });
    } else {
        pair.classList.add('matchup-card-locked');
    }

    // Mark already-won pairs visually
    if (winnerId !== null && winnerId !== undefined) {
        pair.classList.add('matchup-card-decided');
    }

    pair.appendChild(boxA);
    pair.appendChild(boxB);
    slot.appendChild(pair);
    return slot;
}

function renderCrossRounds() {
    // Rounds 5-6 are rendered in a special section between / below the groups
    // We inject them into the bracket container as additional rows if they're active
    let crossSection = el('cross-rounds-section');
    if (!crossSection) {
        crossSection = document.createElement('div');
        crossSection.id = 'cross-rounds-section';
        crossSection.style.cssText = 'grid-column:1/4;grid-row:3;display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 0 10px 0;';
        el('bracket-container').appendChild(crossSection);
    }
    crossSection.innerHTML = '';

    if (currentRound < 5) return;

    // Round 5 - Semi-finals
    const r5Label = document.createElement('div');
    r5Label.style.cssText = 'font-family:cursive;font-size:22px;color:#333;margin-bottom:4px;';
    r5Label.textContent = 'Semi-Finals';
    crossSection.appendChild(r5Label);

    const r5Row = document.createElement('div');
    r5Row.style.cssText = 'display:flex;gap:60px;justify-content:center;';

    for (let i = 0; i < 2; i++) {
        const [mA, mB] = getContestants(5, i);
        const slot = buildCrossMatchupSlot(5, i, mA, mB, 'SF');
        r5Row.appendChild(slot);
    }
    crossSection.appendChild(r5Row);

    if (currentRound < 6) return;

    // Round 6 - Final
    const r6Label = document.createElement('div');
    r6Label.style.cssText = 'font-family:cursive;font-size:22px;color:#333;margin:14px 0 4px 0;';
    r6Label.textContent = 'Final';
    crossSection.appendChild(r6Label);

    const [fA, fB] = getContestants(6, 0);
    const finalSlot = buildCrossMatchupSlot(6, 0, fA, fB, 'F');
    finalSlot.style.marginTop = '0';
    crossSection.appendChild(finalSlot);

    // Submit button after final
    if (!el('submit-area')) {
        const submitArea = document.createElement('div');
        submitArea.id = 'submit-area';
        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-bracket-btn';
        submitBtn.className = 'ripple';
        submitBtn.textContent = 'Submit Your Bracket';
        submitBtn.addEventListener('click', openSubmitModal);
        submitArea.appendChild(submitBtn);
        crossSection.appendChild(submitArea);
    }
}

function buildCrossMatchupSlot(round, globalIdx, mA, mB, prefix) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:2px;align-items:center;';

    const labelA = mA ? `${prefix}${globalIdx * 2 + 1}` : 'TBD';
    const labelB = mB ? `${prefix}${globalIdx * 2 + 2}` : 'TBD';

    // Show seed info
    const descA = mA ? `${mA.group} - ${mA.seed}` : 'TBD';
    const descB = mB ? `${mB.group} - ${mB.seed}` : 'TBD';

    const pair = document.createElement('div');
    pair.className = 'matchup-pair';
    pair.style.cursor = (round === currentRound && mA && mB) ? 'pointer' : 'default';

    const boxA = document.createElement('div');
    boxA.className = 'seed-box' + (round === currentRound && mA && mB ? ' clickable' : '') + (!mA ? ' tbd' : '');
    boxA.textContent = descA;

    const boxB = document.createElement('div');
    boxB.className = 'seed-box' + (round === currentRound && mA && mB ? ' clickable' : '') + (!mB ? ' tbd' : '');
    boxB.textContent = descB;

    const winnerId = winners[round][globalIdx];
    if (winnerId !== null && winnerId !== undefined) {
        if (mA && mA.midrash_id === winnerId) boxA.classList.add('winner');
        if (mB && mB.midrash_id === winnerId) boxB.classList.add('winner');
    }

    if (round === currentRound && mA && mB) {
        const openModal = () => openMatchupModal(round, globalIdx, mA, mB);
        boxA.addEventListener('click', openModal);
        boxB.addEventListener('click', openModal);
    }

    pair.appendChild(boxA);
    pair.appendChild(boxB);
    wrapper.appendChild(pair);
    return wrapper;
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function updateControls() {
    el('round-label').textContent = `Round ${currentRound} of ${TOTAL_ROUNDS}`;

    const backBtn = el('back-btn');
    const advBtn = el('advance-btn');

    backBtn.style.display = currentRound > 1 ? 'inline-block' : 'none';

    // Show advance button if all winners for current round are set and round < 6
    if (currentRound < TOTAL_ROUNDS && allWinnersSet(currentRound)) {
        advBtn.style.display = 'inline-block';
        advBtn.textContent = currentRound === 5 ? 'Go to Final ›' : 'Advance to Next Round ›';
    } else {
        advBtn.style.display = 'none';
    }

    // If round 6 winner is set, hide advance and show submit
    if (currentRound === TOTAL_ROUNDS && allWinnersSet(TOTAL_ROUNDS)) {
        advBtn.style.display = 'none';
    }
}

function allWinnersSet(round) {
    return winners[round].every(w => w !== null && w !== undefined);
}

function advanceRound() {
    if (!allWinnersSet(currentRound)) return;
    if (currentRound >= TOTAL_ROUNDS) return;
    currentRound++;
    renderBracket();
}

function goBack() {
    if (currentRound <= 1) return;
    const confirmed = confirm(
        `Going back will discard all your selections for Round ${currentRound}. Are you sure?`
    );
    if (!confirmed) return;
    // Clear winners for current round
    winners[currentRound] = new Array(winners[currentRound].length).fill(null);
    currentRound--;
    renderBracket();
}

function updateChampion() {
    const champName = el('champion-name');
    const champId = winners[6][0];
    if (champId !== null && champId !== undefined) {
        const champ = midrashById(champId);
        champName.textContent = champ ? `${champ.group} - ${champ.seed}` : '-';
        champName.style.color = 'rgb(39, 174, 96)';
    } else {
        champName.textContent = '-';
        champName.style.color = 'rgb(69, 69, 241)';
    }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openMatchupModal(round, globalIdx, mA, mB) {
    if (round !== currentRound) return;

    // Seed pendingPick from any already-confirmed winner for this matchup
    const existingWinner = (winners[round][globalIdx] !== undefined ? winners[round][globalIdx] : null);
    activeMatchup = { round, index: globalIdx, idA: mA.midrash_id, idB: mB.midrash_id, pendingPick: existingWinner };

    el('seed-a').textContent = `${mA.group} - Seed ${mA.seed}`;
    el('desc-a').textContent = mA.long_desc || mA.short_desc || '';
    el('source-a').textContent = mA.source ? `Source: ${mA.source}` : '';

    el('seed-b').textContent = `${mB.group} - Seed ${mB.seed}`;
    el('desc-b').textContent = mB.long_desc || mB.short_desc || '';
    el('source-b').textContent = mB.source ? `Source: ${mB.source}` : '';

    // Restore any existing highlight and set OK button state
    highlightPick(existingWinner, mA.midrash_id, mB.midrash_id);
    updateOkButton();

    el('matchup-modal').style.display = 'flex';
}

function highlightPick(winnerId, idA, idB) {
    const cardA = el('contestant-a');
    const cardB = el('contestant-b');
    const btnA = el('pick-a');
    const btnB = el('pick-b');

    // Card border highlight
    cardA.style.borderColor = winnerId === idA ? 'rgb(39,174,96)' : 'transparent';
    cardB.style.borderColor = winnerId === idB ? 'rgb(39,174,96)' : 'transparent';

    // Selected class for stronger visual feedback
    cardA.classList.toggle('selected', winnerId === idA);
    cardB.classList.toggle('selected', winnerId === idB);

    // Button states
    btnA.classList.toggle('pick-btn-selected', winnerId === idA);
    btnB.classList.toggle('pick-btn-selected', winnerId === idB);
}

function updateOkButton() {
    const okBtn = el('matchup-ok-btn');
    if (!okBtn) return;
    const hasPick = activeMatchup && activeMatchup.pendingPick !== null;
    okBtn.disabled = !hasPick;
    okBtn.classList.toggle('ok-btn-ready', hasPick);
}

function closeMatchupModal() {
    el('matchup-modal').style.display = 'none';
    activeMatchup = null;
}

/**
 * Called when a pick button is clicked.
 * Only updates the pending in-modal selection — does NOT save to winners[] or close the modal.
 * The user must click OK to confirm.
 */
function pickWinner(midrashId) {
    if (!activeMatchup) return;
    activeMatchup.pendingPick = midrashId;
    highlightPick(midrashId, activeMatchup.idA, activeMatchup.idB);
    updateOkButton();
}

/**
 * Called when the OK button is clicked.
 * Saves the pending pick to winners[] and closes the modal.
 */
function confirmMatchupPick() {
    if (!activeMatchup || activeMatchup.pendingPick === null) return;
    const { round, index, pendingPick } = activeMatchup;
    winners[round][index] = pendingPick;
    closeMatchupModal();
    renderBracket();
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function openSubmitModal() {
    el('submit-error').style.display = 'none';
    el('submit-name').value = '';
    el('submit-email').value = '';
    el('submit-modal').style.display = 'flex';
}

function closeSubmitModal() {
    el('submit-modal').style.display = 'none';
}

async function submitBracket() {
    const name = el('submit-name').value.trim();
    const email = el('submit-email').value.trim();
    const errDiv = el('submit-error');

    if (!name || !email) {
        errDiv.textContent = 'Please enter both your name and email address.';
        errDiv.style.display = 'block';
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errDiv.textContent = 'Please enter a valid email address.';
        errDiv.style.display = 'block';
        return;
    }

    if (!allWinnersSet(6)) {
        errDiv.textContent = 'Please complete all rounds before submitting.';
        errDiv.style.display = 'block';
        return;
    }

    const submitBtn = el('submit-confirm-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const payload = {
        name,
        email,
        round1Winners: winners[1],
        round2Winners: winners[2],
        round3Winners: winners[3],
        round4Winners: winners[4],
        round5Winners: winners[5],
        round6Winners: winners[6],
    };

    try {
        const resp = await fetch('/api/bracket/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (resp.status === 409) {
            errDiv.textContent = 'A bracket with this email address has already been submitted. Each person may only submit one bracket.';
            errDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Bracket';
            return;
        }

        if (!resp.ok) {
            const msg = await resp.text().catch(() => '');
            throw new Error(msg || 'Server error');
        }

        // Success
        closeSubmitModal();
        showSuccessBanner(name);

    } catch (err) {
        errDiv.textContent = `Submission failed: ${err.message}. Please try again.`;
        errDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Bracket';
    }
}

function showSuccessBanner(name) {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center; z-index: 200;
    `;
    banner.innerHTML = `
        <div style="background:rgb(220,220,250);border-radius:14px;padding:48px 56px;max-width:500px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.3);">
            <div style="font-family:cursive;font-size:40px;margin-bottom:16px;">🎉</div>
            <h2 style="font-family:cursive;font-size:32px;margin:0 0 14px 0;">Thank You, ${escapeHtml(name)}!</h2>
            <p style="font-family:'Times New Roman',serif;font-size:18px;line-height:1.6;margin:0 0 24px 0;">
                Your bracket has been submitted successfully. We'll notify you at your email address when the results are in. May your picks be wise!
            </p>
            <a href="index.html" style="font-family:'Times New Roman',serif;font-size:20px;color:rgb(69,69,241);text-decoration:underline;">Return to Home</a>
        </div>
    `;
    document.body.appendChild(banner);
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Ripple Effect ────────────────────────────────────────────────────────────

function attachRipple(container) {
    container.querySelectorAll('.ripple').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const circle = document.createElement('span');
            circle.classList.add('circle');
            circle.style.top = y + 'px';
            circle.style.left = x + 'px';
            this.appendChild(circle);
            setTimeout(() => circle.remove(), 500);
        });
    });
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadMidrashim() {
    const wrapper = el('bracket-wrapper');
    wrapper.innerHTML = '<div id="bracket-loading">Loading bracket data...</div>';

    try {
        const resp = await fetch('/api/bracket/midrashim');
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const data = await resp.json();

        if (!Array.isArray(data) || data.length !== 64) {
            throw new Error(`Expected 64 midrashim, got ${data.length}.`);
        }

        allMidrashim = data;

        // Organise into groups
        groups = { A: [], B: [], C: [], D: [] };
        allMidrashim.forEach(m => {
            const g = m.group ? m.group.toUpperCase() : null;
            if (g && groups[g]) groups[g].push(m);
        });

        // Sort each group by seed ascending (so index 0 = seed 1)
        ['A','B','C','D'].forEach(g => {
            groups[g].sort((a, b) => a.seed - b.seed);
            if (groups[g].length !== 16) {
                throw new Error(`Group ${g} has ${groups[g].length} entries (expected 16).`);
            }
        });

        // Restore bracket container
        wrapper.innerHTML = `
            <div id="bracket-container">
                <div id="group-a" class="bracket-group top-left"></div>
                <div id="group-b" class="bracket-group bottom-left"></div>
                <div id="group-c" class="bracket-group top-right"></div>
                <div id="group-d" class="bracket-group bottom-right"></div>
                <div id="champion-display">
                    <div id="champion-label">Champion</div>
                    <div id="champion-name">-</div>
                </div>
            </div>
        `;

        renderBracket();

    } catch (err) {
        wrapper.innerHTML = `
            <div id="bracket-loading" style="color:#a00;">
                Failed to load bracket data: ${escapeHtml(err.message)}<br>
                Please refresh the page or contact an administrator.
            </div>
        `;
    }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Nav scroll behaviour (matches index.js)
    const nav = document.querySelector('nav');
    nav.classList.remove('active');
    window.addEventListener('scroll', () => {
        if (window.scrollY > nav.offsetHeight + 5) nav.classList.add('active');
        else nav.classList.remove('active');
    });

    // Round controls
    el('back-btn').addEventListener('click', goBack);
    el('advance-btn').addEventListener('click', advanceRound);

    // Modal close buttons
    el('modal-close-btn').addEventListener('click', closeMatchupModal);
    el('submit-modal-close').addEventListener('click', closeSubmitModal);

    // Close modals on overlay click
    el('matchup-modal').addEventListener('click', e => {
        if (e.target === el('matchup-modal')) closeMatchupModal();
    });
    el('submit-modal').addEventListener('click', e => {
        if (e.target === el('submit-modal')) closeSubmitModal();
    });

    // Contestant pick buttons — update pending selection only
    el('pick-a').addEventListener('click', () => {
        if (activeMatchup) pickWinner(activeMatchup.idA);
    });
    el('pick-b').addEventListener('click', () => {
        if (activeMatchup) pickWinner(activeMatchup.idB);
    });

    // OK button — confirm and save the pending pick
    el('matchup-ok-btn').addEventListener('click', confirmMatchupPick);

    // Submit confirm
    el('submit-confirm-btn').addEventListener('click', submitBracket);

    // Ripple on static buttons
    attachRipple(document.body);

    // Load data
    loadMidrashim();
});