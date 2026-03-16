package spring.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import spring.model.MidrashPointTotal;

import javax.sql.DataSource;
import java.util.List;

/**
 * Data Access Object for the results page.
 * <p>
 * The core query counts how many times each midrash_id appears as a winner
 * across all six round tables (round_1 through round_6), broken down by round.
 * <p>
 * Each round table has N winner columns (winner1 ... winnerN). We UNION ALL
 * the winner columns from all rounds into a single (midrash_id, round) stream,
 * then aggregate by midrash_id.
 * <p>
 * All 64 midrashim from midrash_list are always returned via a LEFT JOIN,
 * so midrashim with zero appearances still appear with 0 counts.
 */
@Repository
public class ResultsDao {

    private final JdbcTemplate jdbc;

    public ResultsDao(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    // ─── RowMapper ────────────────────────────────────────────────────────────

    private final RowMapper<MidrashPointTotal> pointTotalRowMapper = (rs, rowNum) -> {
        MidrashPointTotal pt = new MidrashPointTotal();
        pt.setMidrashId(rs.getInt("midrash_id"));
        pt.setTotal(rs.getInt("total"));
        pt.setR1(rs.getInt("r1"));
        pt.setR2(rs.getInt("r2"));
        pt.setR3(rs.getInt("r3"));
        pt.setR4(rs.getInt("r4"));
        pt.setR5(rs.getInt("r5"));
        pt.setR6(rs.getInt("r6"));
        pt.setMaxRound(rs.getInt("max_round"));
        return pt;
    };

    // ─── Query ────────────────────────────────────────────────────────────────

    /**
     * Returns aggregated point totals for every midrash in midrash_list.
     * <p>
     * Strategy:
     *   1. Build a UNION ALL of every winner column from every round table,
     *      tagging each row with its round number and the midrash_id value.
     *   2. Filter out NULL winner columns (unplayed matchups).
     *   3. LEFT JOIN midrash_list so all 64 appear even with 0 points.
     *   4. Use conditional aggregation (SUM + CASE) to split counts by round.
     *   5. Compute max_round as the highest round in which the midrash appeared.
     * <p>
     * The winner columns are unpivoted using UNION ALL rather than a dynamic pivot
     * to keep this compatible with all MySQL 5.7+ / 8.x versions without stored
     * procedures or dynamic SQL.
     */
    public List<MidrashPointTotal> getPointTotals() {
        /*
         * Inner query: one row per (midrash_id, round) appearance.
         *
         * round_1  has winner1...winner32  (32 columns)
         * round_2  has winner1...winner16  (16 columns)
         * round_3  has winner1...winner8   ( 8 columns)
         * round_4  has winner1...winner4   ( 4 columns)
         * round_5  has winner1...winner2   ( 2 columns)
         * round_6  has winner1            ( 1 column)
         *
         * Each UNION ALL segment selects the winner value and tags it with
         * the round number. NULLs are excluded by the WHERE clause so that
         * brackets that haven't been filled in don't skew results.
         */
        String sql =
                "SELECT " +
                        "    ml.midrash_id, " +
                        "    COALESCE(SUM(CASE WHEN w.round = 1 THEN 1 ELSE 0 END), 0) AS r1, " +
                        "    COALESCE(SUM(CASE WHEN w.round = 2 THEN 1 ELSE 0 END), 0) AS r2, " +
                        "    COALESCE(SUM(CASE WHEN w.round = 3 THEN 1 ELSE 0 END), 0) AS r3, " +
                        "    COALESCE(SUM(CASE WHEN w.round = 4 THEN 1 ELSE 0 END), 0) AS r4, " +
                        "    COALESCE(SUM(CASE WHEN w.round = 5 THEN 1 ELSE 0 END), 0) AS r5, " +
                        "    COALESCE(SUM(CASE WHEN w.round = 6 THEN 1 ELSE 0 END), 0) AS r6, " +
                        "    COALESCE(COUNT(w.midrash_id), 0)                           AS total, " +
                        "    COALESCE(MAX(w.round), 0)                                  AS max_round " +
                        "FROM midrash_list ml " +
                        "LEFT JOIN ( " +
                        buildUnpivotUnion() +
                        ") w ON w.midrash_id = ml.midrash_id " +
                        "GROUP BY ml.midrash_id " +
                        "ORDER BY ml.midrash_id";

        return jdbc.query(sql, pointTotalRowMapper);
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /**
     * Builds the UNION ALL sub-query that unpivots all winner columns from
     * all six round tables into a flat (midrash_id, round) stream.
     * <p>
     * Each SELECT in the union produces one row per non-NULL winner value,
     * tagged with its round number. The completed_bracket table links brackets
     * to rounds, so we join through it to reach the round rows.
     */
    private String buildUnpivotUnion() {
        StringBuilder sb = new StringBuilder();

        // round_1: winner1..winner32
        appendRoundUnion(sb, "round_1", "r1_id", "round_1_id", 32, 1);
        // round_2: winner1..winner16
        appendRoundUnion(sb, "round_2", "r2_id", "round_2_id", 16, 2);
        // round_3: winner1..winner8
        appendRoundUnion(sb, "round_3", "r3_id", "round_3_id", 8, 3);
        // round_4: winner1..winner4
        appendRoundUnion(sb, "round_4", "r4_id", "round_4_id", 4, 4);
        // round_5: winner1..winner2
        appendRoundUnion(sb, "round_5", "r5_id", "round_5_id", 2, 5);
        // round_6: winner1 only
        appendRoundUnion(sb, "round_6", "r6_id", "round_6_id", 1, 6);

        // Remove trailing " UNION ALL "
        int trailingUnion = sb.lastIndexOf(" UNION ALL ");
        if (trailingUnion >= 0) sb.setLength(trailingUnion);

        return sb.toString();
    }

    /**
     * Appends the UNION ALL segments for a single round table.
     * One SELECT per winner column, each joining through completed_bracket
     * so we only count winners from actually-submitted brackets.
     *
     * @param sb          StringBuilder to append to
     * @param tableName   e.g. "round_1"
     * @param pkCol       primary key column name, e.g. "r1_id"
     * @param fkCol       foreign key column in completed_bracket, e.g. "round_1_id"
     * @param numWinners  number of winner columns in this round table
     * @param roundNum    round number tag (1-6)
     */
    private void appendRoundUnion(StringBuilder sb, String tableName, String pkCol,
                                  String fkCol, int numWinners, int roundNum) {
        for (int i = 1; i <= numWinners; i++) {
            sb.append("    SELECT r.winner").append(i)
                    .append(" AS midrash_id, ").append(roundNum).append(" AS round ")
                    .append("FROM ").append(tableName).append(" r ")
                    .append("JOIN completed_bracket cb ON cb.").append(fkCol)
                    .append(" = r.").append(pkCol).append(' ')
                    .append("WHERE r.winner").append(i).append(" IS NOT NULL ")
                    .append(" UNION ALL ");
        }
    }
}