package spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response body for a single user's completed bracket.
 * Returned by GET /api/bracket/user/{bracketId}.
 * <p>
 * Contains the submitter's name and their six round winner arrays,
 * mirroring the shape of BracketSubmitRequest so the frontend can
 * reuse the same bracket-rendering logic.
 */
public class UserBracketResponse {

    @JsonProperty("bracket_id")
    private int bracketId;

    @JsonProperty("name")
    private String name;

    /** 32 midrash_ids — round-1 winners */
    @JsonProperty("round1Winners")
    private List<Integer> round1Winners;

    /** 16 midrash_ids — round-2 winners */
    @JsonProperty("round2Winners")
    private List<Integer> round2Winners;

    /** 8 midrash_ids — round-3 winners */
    @JsonProperty("round3Winners")
    private List<Integer> round3Winners;

    /** 4 midrash_ids — round-4 winners */
    @JsonProperty("round4Winners")
    private List<Integer> round4Winners;

    /** 2 midrash_ids — round-5 winners */
    @JsonProperty("round5Winners")
    private List<Integer> round5Winners;

    /** 1 midrash_id — champion */
    @JsonProperty("round6Winners")
    private List<Integer> round6Winners;

    // ─── Getters & Setters ────────────────────────────────────────────────────

    public int getBracketId() { return bracketId; }
    public void setBracketId(int bracketId) { this.bracketId = bracketId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<Integer> getRound1Winners() { return round1Winners; }
    public void setRound1Winners(List<Integer> round1Winners) { this.round1Winners = round1Winners; }

    public List<Integer> getRound2Winners() { return round2Winners; }
    public void setRound2Winners(List<Integer> round2Winners) { this.round2Winners = round2Winners; }

    public List<Integer> getRound3Winners() { return round3Winners; }
    public void setRound3Winners(List<Integer> round3Winners) { this.round3Winners = round3Winners; }

    public List<Integer> getRound4Winners() { return round4Winners; }
    public void setRound4Winners(List<Integer> round4Winners) { this.round4Winners = round4Winners; }

    public List<Integer> getRound5Winners() { return round5Winners; }
    public void setRound5Winners(List<Integer> round5Winners) { this.round5Winners = round5Winners; }

    public List<Integer> getRound6Winners() { return round6Winners; }
    public void setRound6Winners(List<Integer> round6Winners) { this.round6Winners = round6Winners; }
}