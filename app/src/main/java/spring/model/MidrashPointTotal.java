package spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents the aggregated point totals for a single midrash across all bracket submissions.
 * <p>
 * Points are earned each time the midrash_id appears in any round winner column.
 * Each field maps to a JSON property consumed by resultsPage.js.
 */
public class MidrashPointTotal {

    @JsonProperty("midrash_id")
    private int midrashId;

    /** Sum of appearances across all six round winner tables. */
    @JsonProperty("total")
    private int total;

    /** Points earned in round 1 (appearances in round_1 winner columns). */
    @JsonProperty("r1")
    private int r1;

    /** Points earned in round 2. */
    @JsonProperty("r2")
    private int r2;

    /** Points earned in round 3. */
    @JsonProperty("r3")
    private int r3;

    /** Points earned in round 4. */
    @JsonProperty("r4")
    private int r4;

    /** Points earned in round 5 (semi-finals). */
    @JsonProperty("r5")
    private int r5;

    /** Points earned in round 6 (final / champion). */
    @JsonProperty("r6")
    private int r6;

    /**
     * The highest round number in which this midrash appeared as a winner (1-6), or 0 if never.
     * Used as a tiebreaker: a midrash that reached round 3 outranks one that only reached round 1.
     */
    @JsonProperty("max_round")
    private int maxRound;

    // ─── Getters & Setters ────────────────────────────────────────────────────

    public int getMidrashId() { return midrashId; }
    public void setMidrashId(int midrashId) { this.midrashId = midrashId; }

    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }

    public int getR1() { return r1; }
    public void setR1(int r1) { this.r1 = r1; }

    public int getR2() { return r2; }
    public void setR2(int r2) { this.r2 = r2; }

    public int getR3() { return r3; }
    public void setR3(int r3) { this.r3 = r3; }

    public int getR4() { return r4; }
    public void setR4(int r4) { this.r4 = r4; }

    public int getR5() { return r5; }
    public void setR5(int r5) { this.r5 = r5; }

    public int getR6() { return r6; }
    public void setR6(int r6) { this.r6 = r6; }

    public int getMaxRound() { return maxRound; }
    public void setMaxRound(int maxRound) { this.maxRound = maxRound; }
}