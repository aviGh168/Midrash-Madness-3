package spring.service;

import org.springframework.stereotype.Service;
import spring.dao.BracketDao;
import spring.model.CompletedBracketWinners;
import spring.model.LeaderboardEntry;
import spring.model.Midrash;
import spring.model.MidrashPointTotal;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Computes the admin "closest to the People's Bracket" leaderboard.
 * <p>
 * Scoring: for every submitter, and for every round/slot, one point is
 * awarded for round 1, two for round 2, three for round 3, and so on
 * (i.e. the round number itself), whenever that submitter's pick in that
 * exact slot matches the computed People's Bracket's pick in that same slot.
 * <p>
 * Ranking uses standard competition ranking: tied scores share the same rank
 * number, and the next distinct score continues from the row count rather
 * than the number of distinct scores seen (e.g. two submitters tied for 2nd
 * means the next submitter is ranked 4th, not 3rd).
 */
@Service
public class LeaderboardService {

    private final BracketDao bracketDao;
    private final BracketService bracketService;
    private final ResultsService resultsService;
    private final PeoplesBracketService peoplesBracketService;

    public LeaderboardService(BracketDao bracketDao,
                              BracketService bracketService,
                              ResultsService resultsService,
                              PeoplesBracketService peoplesBracketService) {
        this.bracketDao            = bracketDao;
        this.bracketService        = bracketService;
        this.resultsService        = resultsService;
        this.peoplesBracketService = peoplesBracketService;
    }

    /**
     * Computes and returns the full leaderboard, sorted by points descending
     * (alphabetical by name as the tiebreak), with competition-style ranks.
     */
    public List<LeaderboardEntry> getLeaderboard() {
        List<Midrash> allMidrashim              = bracketService.getAllMidrashim();
        List<MidrashPointTotal> pointTotals      = resultsService.getPointTotals();
        PeoplesBracketService.PeoplesBracket peoplesBracket =
                peoplesBracketService.computeBracket(allMidrashim, pointTotals);

        List<CompletedBracketWinners> submissions = bracketDao.getAllCompletedBracketsWithWinners();

        List<ScoredSubmission> scored = new ArrayList<>(submissions.size());
        for (CompletedBracketWinners submission : submissions) {
            int points = scoreSubmission(submission, peoplesBracket);
            scored.add(new ScoredSubmission(submission.getName(), points));
        }

        // Sort: points descending, then name ascending (alphabetical) for ties.
        scored.sort(Comparator
                .comparingInt((ScoredSubmission s) -> -s.points)
                .thenComparing(s -> s.name, String.CASE_INSENSITIVE_ORDER));

        return assignRanks(scored);
    }

    /**
     * Sums points for one submission across all six rounds.
     * A point is only awarded when both the submitter's pick and the
     * People's Bracket's pick exist (non-null) and are equal.
     */
    private int scoreSubmission(CompletedBracketWinners submission,
                                PeoplesBracketService.PeoplesBracket peoplesBracket) {
        int points = 0;
        for (int round = 1; round <= 6; round++) {
            List<Integer> submitterWinners = submission.getWinnersForRound(round);
            Integer[] peoplesWinners       = peoplesBracket.winnersByRound.get(round);

            int slots = Math.min(submitterWinners.size(), peoplesWinners.length);
            for (int i = 0; i < slots; i++) {
                Integer submitterPick = submitterWinners.get(i);
                Integer peoplesPick   = peoplesWinners[i];
                if (submitterPick != null && submitterPick.equals(peoplesPick)) {
                    points += round;
                }
            }
        }
        return points;
    }

    /**
     * Assigns competition ranks to an already points-sorted list: ties share
     * a rank, and the next distinct score's rank is its 1-based position in
     * the list (so two people tied for rank 2 are followed by rank 4, not 3).
     */
    private List<LeaderboardEntry> assignRanks(List<ScoredSubmission> sorted) {
        List<LeaderboardEntry> entries = new ArrayList<>(sorted.size());
        int rank = 0;
        int previousPoints = Integer.MIN_VALUE;

        for (int i = 0; i < sorted.size(); i++) {
            ScoredSubmission s = sorted.get(i);
            if (s.points != previousPoints) {
                rank = i + 1;
                previousPoints = s.points;
            }
            entries.add(new LeaderboardEntry(rank, s.name, s.points));
        }
        return entries;
    }

    /** Internal pairing of a submitter's name with their computed score. */
    private static class ScoredSubmission {
        final String name;
        final int points;

        ScoredSubmission(String name, int points) {
            this.name   = name;
            this.points = points;
        }
    }
}