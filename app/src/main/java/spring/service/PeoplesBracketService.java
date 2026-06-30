package spring.service;

import org.springframework.stereotype.Service;
import spring.model.Midrash;
import spring.model.MidrashPointTotal;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Computes "The People's Bracket" — the same algorithmically-filled bracket
 * shown on the results page (resultsPage.js {@code computeBracket()}) — but
 * in Java, so it can be scored against admin-side submissions without
 * a browser.
 * <p>
 * This mirrors resultsPage.js exactly:
 * <ul>
 *   <li>Round 1 matchups pair seeds within each of the 4 groups using the
 *       standard tournament seeding (1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15).</li>
 *   <li>Every later round's matchups are built from the previous round's
 *       <em>computed</em> winners, not from raw input.</li>
 *   <li>Ties are broken in order: (1) total points, (2) points earned in the
 *       specific round being decided, (3) furthest round reached overall,
 *       (4) random.</li>
 * </ul>
 * Because tier 4 is genuinely random, the result of this computation can
 * differ between calls whenever a true tie reaches that tier — this matches
 * the behavior of resultsPage.js, which re-randomizes on every page load.
 */
@Service
public class PeoplesBracketService {

    /** Seed pairings for round 1 within a 16-team group (0-indexed seed positions). */
    private static final int[][] SEED_PAIRS_R1 = {
            {0, 15}, // 1 vs 16
            {7, 8},  // 8 vs 9
            {4, 11}, // 5 vs 12
            {3, 12}, // 4 vs 13
            {2, 13}, // 3 vs 14
            {5, 10}, // 6 vs 11
            {6, 9},  // 7 vs 10
            {1, 14}, // 2 vs 15
    };

    private static final String[] GROUP_NAMES = {"A", "B", "C", "D"};

    private final Random random = new Random();

    /**
     * Computed People's Bracket winners, keyed by round (1-6).
     * Round sizes: 32, 16, 8, 4, 2, 1.
     */
    public static class PeoplesBracket {
        public final Map<Integer, Integer[]> winnersByRound = new HashMap<>();
    }

    /**
     * Builds the People's Bracket from the given midrashim and point totals.
     *
     * @param allMidrashim all 64 midrashim (any order)
     * @param pointTotals  point totals for all 64 midrashim, as returned by
     *                     {@code ResultsService#getPointTotals()}
     * @return the computed bracket, with one Integer[] of winner ids per round
     */
    public PeoplesBracket computeBracket(List<Midrash> allMidrashim, List<MidrashPointTotal> pointTotals) {
        // Group lookups: group letter -> array of 16 midrashim indexed by seed (1-16 -> 0-15)
        Map<String, Midrash[]> groups = new HashMap<>();
        for (String g : GROUP_NAMES) groups.put(g, new Midrash[16]);

        Map<Integer, Midrash> midrashById = new HashMap<>();
        for (Midrash m : allMidrashim) {
            midrashById.put(m.getMidrashId(), m);
            String g = m.getGroup() == null ? null : m.getGroup().toUpperCase();
            if (g != null && groups.containsKey(g)) {
                int seedIdx = m.getSeed() - 1; // seeds are 1-16
                if (seedIdx >= 0 && seedIdx < 16) {
                    groups.get(g)[seedIdx] = m;
                }
            }
        }

        Map<Integer, MidrashPointTotal> pointsById = new HashMap<>();
        for (MidrashPointTotal pt : pointTotals) {
            pointsById.put(pt.getMidrashId(), pt);
        }

        PeoplesBracket bracket = new PeoplesBracket();
        bracket.winnersByRound.put(1, new Integer[32]);
        bracket.winnersByRound.put(2, new Integer[16]);
        bracket.winnersByRound.put(3, new Integer[8]);
        bracket.winnersByRound.put(4, new Integer[4]);
        bracket.winnersByRound.put(5, new Integer[2]);
        bracket.winnersByRound.put(6, new Integer[1]);

        // ── Round 1: 32 matchups, 8 per group ───────────────────────────────
        Integer[] r1 = bracket.winnersByRound.get(1);
        for (int gi = 0; gi < 4; gi++) {
            Midrash[] group = groups.get(GROUP_NAMES[gi]);
            for (int li = 0; li < 8; li++) {
                int globalIdx = gi * 8 + li;
                int[] pair = SEED_PAIRS_R1[li];
                Midrash mA = group[pair[0]];
                Midrash mB = group[pair[1]];
                r1[globalIdx] = pickWinner(mA, mB, 1, pointsById);
            }
        }

        // ── Round 2: 16 matchups, 4 per group ───────────────────────────────
        Integer[] r2 = bracket.winnersByRound.get(2);
        for (int gi = 0; gi < 4; gi++) {
            for (int li = 0; li < 4; li++) {
                int globalIdx = gi * 4 + li;
                int prevOff = gi * 8;
                Midrash mA = midrashById.get(r1[prevOff + li * 2]);
                Midrash mB = midrashById.get(r1[prevOff + li * 2 + 1]);
                r2[globalIdx] = pickWinner(mA, mB, 2, pointsById);
            }
        }

        // ── Round 3: 8 matchups, 2 per group ────────────────────────────────
        Integer[] r3 = bracket.winnersByRound.get(3);
        for (int gi = 0; gi < 4; gi++) {
            for (int li = 0; li < 2; li++) {
                int globalIdx = gi * 2 + li;
                int prevOff = gi * 4;
                Midrash mA = midrashById.get(r2[prevOff + li * 2]);
                Midrash mB = midrashById.get(r2[prevOff + li * 2 + 1]);
                r3[globalIdx] = pickWinner(mA, mB, 3, pointsById);
            }
        }

        // ── Round 4: 4 matchups (group finals), 1 per group ─────────────────
        Integer[] r4 = bracket.winnersByRound.get(4);
        for (int gi = 0; gi < 4; gi++) {
            int prevOff = gi * 2;
            Midrash mA = midrashById.get(r3[prevOff]);
            Midrash mB = midrashById.get(r3[prevOff + 1]);
            r4[gi] = pickWinner(mA, mB, 4, pointsById);
        }

        // ── Round 5: 2 matchups (semi-finals) ───────────────────────────────
        Integer[] r5 = bracket.winnersByRound.get(5);
        {
            Midrash mA0 = midrashById.get(r4[0]);
            Midrash mB0 = midrashById.get(r4[1]);
            r5[0] = pickWinner(mA0, mB0, 5, pointsById);

            Midrash mA1 = midrashById.get(r4[2]);
            Midrash mB1 = midrashById.get(r4[3]);
            r5[1] = pickWinner(mA1, mB1, 5, pointsById);
        }

        // ── Round 6: final ───────────────────────────────────────────────────
        Integer[] r6 = bracket.winnersByRound.get(6);
        {
            Midrash mA = midrashById.get(r5[0]);
            Midrash mB = midrashById.get(r5[1]);
            r6[0] = pickWinner(mA, mB, 6, pointsById);
        }

        return bracket;
    }

    /**
     * Picks the winner between two midrashim for the given round, applying
     * the same four-tier tiebreak as resultsPage.js's {@code pickWinner()}.
     * Either side may be null if a group/round had a bye-like gap; in that
     * case the non-null side wins outright (mirrors the JS's optional-chaining
     * fallback behavior).
     */
    private Integer pickWinner(Midrash mA, Midrash mB, int round, Map<Integer, MidrashPointTotal> pointsById) {
        if (mA == null && mB == null) return null;
        if (mA == null) return mB.getMidrashId();
        if (mB == null) return mA.getMidrashId();

        MidrashPointTotal ptA = pointsById.get(mA.getMidrashId());
        MidrashPointTotal ptB = pointsById.get(mB.getMidrashId());
        int totalA = ptA == null ? 0 : ptA.getTotal();
        int totalB = ptB == null ? 0 : ptB.getTotal();

        // Tiebreak 1: total points
        if (totalA != totalB) return totalA > totalB ? mA.getMidrashId() : mB.getMidrashId();

        // Tiebreak 2: points in this specific round
        int roundPtsA = pointsInRound(ptA, round);
        int roundPtsB = pointsInRound(ptB, round);
        if (roundPtsA != roundPtsB) return roundPtsA > roundPtsB ? mA.getMidrashId() : mB.getMidrashId();

        // Tiebreak 3: furthest round reached
        int maxRoundA = ptA == null ? 0 : ptA.getMaxRound();
        int maxRoundB = ptB == null ? 0 : ptB.getMaxRound();
        if (maxRoundA != maxRoundB) return maxRoundA > maxRoundB ? mA.getMidrashId() : mB.getMidrashId();

        // Tiebreak 4: random
        return random.nextBoolean() ? mA.getMidrashId() : mB.getMidrashId();
    }

    private int pointsInRound(MidrashPointTotal pt, int round) {
        if (pt == null) return 0;
        return switch (round) {
            case 1 -> pt.getR1();
            case 2 -> pt.getR2();
            case 3 -> pt.getR3();
            case 4 -> pt.getR4();
            case 5 -> pt.getR5();
            case 6 -> pt.getR6();
            default -> 0;
        };
    }
}