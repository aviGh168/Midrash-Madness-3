package spring.model;

import java.util.List;

/**
 * Internal carrier for one submitter's full set of round winners, used by
 * {@code BracketDao#getAllCompletedBracketsWithWinners()} and consumed by
 * {@code LeaderboardService} to score each submission against the People's
 * Bracket.
 * <p>
 * This is not exposed directly over the API — it's an internal DTO between
 * the DAO and service layers, distinct from {@code UserBracketResponse}
 * (which is the public per-bracket API shape).
 */
public class CompletedBracketWinners {

    private final int bracketId;
    private final String name;
    private final List<Integer> round1Winners;
    private final List<Integer> round2Winners;
    private final List<Integer> round3Winners;
    private final List<Integer> round4Winners;
    private final List<Integer> round5Winners;
    private final List<Integer> round6Winners;

    public CompletedBracketWinners(int bracketId,
                                   String name,
                                   List<Integer> round1Winners,
                                   List<Integer> round2Winners,
                                   List<Integer> round3Winners,
                                   List<Integer> round4Winners,
                                   List<Integer> round5Winners,
                                   List<Integer> round6Winners) {
        this.bracketId      = bracketId;
        this.name           = name;
        this.round1Winners  = round1Winners;
        this.round2Winners  = round2Winners;
        this.round3Winners  = round3Winners;
        this.round4Winners  = round4Winners;
        this.round5Winners  = round5Winners;
        this.round6Winners  = round6Winners;
    }

    public int getBracketId()                  { return bracketId; }
    public String getName()                     { return name; }
    public List<Integer> getRound1Winners()      { return round1Winners; }
    public List<Integer> getRound2Winners()      { return round2Winners; }
    public List<Integer> getRound3Winners()      { return round3Winners; }
    public List<Integer> getRound4Winners()      { return round4Winners; }
    public List<Integer> getRound5Winners()      { return round5Winners; }
    public List<Integer> getRound6Winners()      { return round6Winners; }

    /**
     * Returns this submitter's winner list for the given round (1-6).
     *
     * @throws IllegalArgumentException if round is not in [1,6]
     */
    public List<Integer> getWinnersForRound(int round) {
        return switch (round) {
            case 1 -> round1Winners;
            case 2 -> round2Winners;
            case 3 -> round3Winners;
            case 4 -> round4Winners;
            case 5 -> round5Winners;
            case 6 -> round6Winners;
            default -> throw new IllegalArgumentException("round must be in [1,6], got " + round);
        };
    }
}