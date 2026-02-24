package spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Request body for bracket submission.
 * Maps to the JSON payload sent by bracketPage.js on submit.
 * <p>
 * winner lists:
 *   round1Winners - 32 midrash_ids (groups A,B,C,D each contribute 8, in order)
 *   round2Winners - 16 midrash_ids
 *   round3Winners -  8 midrash_ids
 *   round4Winners -  4 midrash_ids
 *   round5Winners -  2 midrash_ids (semi-final winners)
 *   round6Winners -  1 midrash_id  (champion)
 * <p>
 * Order within each list follows the group ordering: A matchups, then B, then C, then D.
 */
public class BracketSubmitRequest {

    private String name;
    private String email;

    @JsonProperty("round1Winners")
    private List<Integer> round1Winners;

    @JsonProperty("round2Winners")
    private List<Integer> round2Winners;

    @JsonProperty("round3Winners")
    private List<Integer> round3Winners;

    @JsonProperty("round4Winners")
    private List<Integer> round4Winners;

    @JsonProperty("round5Winners")
    private List<Integer> round5Winners;

    @JsonProperty("round6Winners")
    private List<Integer> round6Winners;

    // ─── Getters & Setters ────────────────────────────────────────────────────

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

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