package spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A lightweight projection of a submitted bracket used to populate
 * the admin page dropdown.
 * <p>
 * Contains only the bracket_id and the submitter's name — no picks.
 * The full bracket is fetched separately via GET /api/admin/brackets/{bracketId}
 * when the admin selects a user.
 */
public class AdminBracketSummary {

    @JsonProperty("bracket_id")
    private int bracketId;

    @JsonProperty("name")
    private String name;

    public AdminBracketSummary(int bracketId, String name) {
        this.bracketId = bracketId;
        this.name      = name;
    }

    public int getBracketId()  { return bracketId; }
    public String getName()    { return name; }
}