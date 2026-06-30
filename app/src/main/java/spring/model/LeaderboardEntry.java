package spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A single row in the admin "closest to the People's Bracket" leaderboard.
 * <p>
 * {@code points} is computed by comparing a submitter's round winners against
 * the computed People's Bracket: one point is awarded for round 1, two for
 * round 2, three for round 3, and so on (i.e. the matchup's round number),
 * for every slot where the submitter's pick matches the People's Bracket's
 * pick in that exact slot.
 * <p>
 * {@code rank} uses standard competition ranking — tied scores share the same
 * rank number, and the next distinct score skips ahead accordingly (e.g. two
 * people tied for 2nd means the next person is ranked 4th).
 */
public class LeaderboardEntry {

    @JsonProperty("rank")
    private int rank;

    @JsonProperty("name")
    private String name;

    @JsonProperty("points")
    private int points;

    public LeaderboardEntry(int rank, String name, int points) {
        this.rank   = rank;
        this.name   = name;
        this.points = points;
    }

    public int getRank()       { return rank; }
    public String getName()    { return name; }
    public int getPoints()     { return points; }
}