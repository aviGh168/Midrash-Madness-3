package spring.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import spring.model.CompletedBracketWinners;
import spring.model.Midrash;

import javax.sql.DataSource;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Data Access Object for bracket operations.
 * Uses JdbcTemplate consistent with the project's DataSource configuration.
 */
@Repository
public class BracketDao {

    private final JdbcTemplate jdbc;

    public BracketDao(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    // ─── RowMappers ───────────────────────────────────────────────────────────

    private final RowMapper<Midrash> midrashRowMapper = (rs, rowNum) -> {
        Midrash m = new Midrash();
        m.setMidrashId(rs.getInt("midrash_id"));
        m.setGroup(rs.getString("group"));
        m.setSeed(rs.getInt("seed"));
        m.setShortDesc(rs.getString("short_desc"));
        m.setLongDesc(rs.getString("long_desc"));
        m.setSource(rs.getString("source"));
        return m;
    };

    // ─── Midrash queries ──────────────────────────────────────────────────────

    /**
     * Returns all 64 midrashim ordered by group then seed.
     */
    public List<Midrash> getAllMidrashim() {
        String sql = "SELECT midrash_id, `group`, seed, short_desc, long_desc, source " +
                "FROM midrash_list ORDER BY `group`, seed";
        return jdbc.query(sql, midrashRowMapper);
    }

    // ─── User queries ─────────────────────────────────────────────────────────

    /**
     * Returns true if a user with the given email already exists.
     */
    public boolean userEmailExists(String email) {
        String sql = "SELECT COUNT(*) FROM midrash_users WHERE email = ?";
        Integer count = jdbc.queryForObject(sql, Integer.class, email);
        return count != null && count > 0;
    }

    /**
     * Inserts a new user and returns the generated user_id.
     */
    public int insertUser(String name, String email) {
        String sql = "INSERT INTO midrash_users (name, email) VALUES (?, ?)";
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, name);
            ps.setString(2, email);
            return ps;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).intValue();
    }

    // ─── Bulk bracket fetch (for admin leaderboard scoring) ───────────────────

    /**
     * Returns every completed bracket's full set of round winners in a single
     * query, joined with the submitter's name.
     * <p>
     * Used by the admin leaderboard endpoint to score every submission against
     * the computed People's Bracket without issuing a separate query per user
     * (as {@code getBracketById} would require if called in a loop).
     * <p>
     * Each round table is joined once via its foreign key on completed_bracket;
     * all of that table's winner columns are selected in the same row, so the
     * whole bracket for one user comes back as a single result row.
     */
    public List<CompletedBracketWinners> getAllCompletedBracketsWithWinners() {
        String sql =
                "SELECT cb.bracket_id, u.name, " +
                        buildWinnerColumnList("r1", 32) + ", " +
                        buildWinnerColumnList("r2", 16) + ", " +
                        buildWinnerColumnList("r3", 8) + ", " +
                        buildWinnerColumnList("r4", 4) + ", " +
                        buildWinnerColumnList("r5", 2) + ", " +
                        buildWinnerColumnList("r6", 1) +
                        " FROM completed_bracket cb " +
                        "JOIN midrash_users u ON u.user_id = cb.user_id " +
                        "JOIN round_1 r1 ON r1.r1_id = cb.round_1_id " +
                        "JOIN round_2 r2 ON r2.r2_id = cb.round_2_id " +
                        "JOIN round_3 r3 ON r3.r3_id = cb.round_3_id " +
                        "JOIN round_4 r4 ON r4.r4_id = cb.round_4_id " +
                        "JOIN round_5 r5 ON r5.r5_id = cb.round_5_id " +
                        "JOIN round_6 r6 ON r6.r6_id = cb.round_6_id " +
                        "ORDER BY u.name ASC";

        return jdbc.query(sql, this::mapCompletedBracketRow);
    }

    /**
     * Builds a comma-separated SELECT fragment aliasing a round table's
     * winner columns as {@code prefix_1, prefix_2, ...} so they can be read
     * back unambiguously regardless of round (every round table names its
     * own columns winner1, winner2, ... which would otherwise collide once
     * all six tables are joined into the same row).
     */
    private String buildWinnerColumnList(String alias, int numWinners) {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= numWinners; i++) {
            if (i > 1) sb.append(", ");
            sb.append(alias).append(".winner").append(i)
                    .append(" AS ").append(alias).append('_').append(i);
        }
        return sb.toString();
    }

    /**
     * Maps one joined row (one user's full bracket) into a CompletedBracketWinners.
     * Reads each round's winner columns back out using the same r{n}_{i} aliases
     * produced by buildWinnerColumnList.
     */
    private CompletedBracketWinners mapCompletedBracketRow(ResultSet rs, int rowNum) throws SQLException {
        return new CompletedBracketWinners(
                rs.getInt("bracket_id"),
                rs.getString("name"),
                readWinnerColumns(rs, "r1", 32),
                readWinnerColumns(rs, "r2", 16),
                readWinnerColumns(rs, "r3", 8),
                readWinnerColumns(rs, "r4", 4),
                readWinnerColumns(rs, "r5", 2),
                readWinnerColumns(rs, "r6", 1)
        );
    }

    /**
     * Reads back the {@code prefix_1 .. prefix_n} columns from the current
     * ResultSet row into a List<Integer>, preserving column order.
     * Uses getObject so a NULL winner (unfilled matchup) maps to a null
     * Integer rather than silently becoming 0.
     */
    private List<Integer> readWinnerColumns(ResultSet rs, String prefix, int numWinners) throws SQLException {
        List<Integer> winners = new ArrayList<>(numWinners);
        for (int i = 1; i <= numWinners; i++) {
            winners.add((Integer) rs.getObject(prefix + "_" + i));
        }
        return winners;
    }

    // ─── Round insertion helpers ──────────────────────────────────────────────

    /**
     * Inserts a row into round_1 (32 winners) and returns the generated r1_id.
     */
    public int insertRound1(List<Integer> winners) {
        if (winners.size() != 32) throw new IllegalArgumentException("round_1 requires exactly 32 winners");
        String sql = buildInsertSql("round_1", 32);
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < 32; i++) ps.setObject(i + 1, winners.get(i));
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    /**
     * Inserts a row into round_2 (16 winners) and returns the generated r2_id.
     */
    public int insertRound2(List<Integer> winners) {
        if (winners.size() != 16) throw new IllegalArgumentException("round_2 requires exactly 16 winners");
        String sql = buildInsertSql("round_2", 16);
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < 16; i++) ps.setObject(i + 1, winners.get(i));
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    /**
     * Inserts a row into round_3 (8 winners) and returns the generated r3_id.
     */
    public int insertRound3(List<Integer> winners) {
        if (winners.size() != 8) throw new IllegalArgumentException("round_3 requires exactly 8 winners");
        String sql = buildInsertSql("round_3", 8);
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < 8; i++) ps.setObject(i + 1, winners.get(i));
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    /**
     * Inserts a row into round_4 (4 winners) and returns the generated r4_id.
     */
    public int insertRound4(List<Integer> winners) {
        if (winners.size() != 4) throw new IllegalArgumentException("round_4 requires exactly 4 winners");
        String sql = buildInsertSql("round_4", 4);
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < 4; i++) ps.setObject(i + 1, winners.get(i));
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    /**
     * Inserts a row into round_5 (2 winners) and returns the generated r5_id.
     */
    public int insertRound5(List<Integer> winners) {
        if (winners.size() != 2) throw new IllegalArgumentException("round_5 requires exactly 2 winners");
        String sql = buildInsertSql("round_5", 2);
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < 2; i++) ps.setObject(i + 1, winners.get(i));
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    /**
     * Inserts a row into round_6 (1 winner / champion) and returns the generated r6_id.
     */
    public int insertRound6(int winnerId) {
        String sql = "INSERT INTO round_6 (winner1) VALUES (?)";
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, winnerId);
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    /**
     * Inserts a completed_bracket row linking all round rows to the user.
     * Returns the generated bracket_id so it can be included in the
     * confirmation email link.
     */
    public int insertCompletedBracket(int userId, int r1Id, int r2Id, int r3Id,
                                      int r4Id, int r5Id, int r6Id) {
        String sql = "INSERT INTO completed_bracket " +
                "(user_id, round_1_id, round_2_id, round_3_id, round_4_id, round_5_id, round_6_id) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)";
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, userId);
            ps.setInt(2, r1Id);
            ps.setInt(3, r2Id);
            ps.setInt(4, r3Id);
            ps.setInt(5, r4Id);
            ps.setInt(6, r5Id);
            ps.setInt(7, r6Id);
            return ps;
        }, kh);
        return Objects.requireNonNull(kh.getKey()).intValue();
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /**
     * Builds an INSERT SQL string for a round table with N winner columns.
     * e.g. "INSERT INTO round_1 (winner1, winner2, ...) VALUES (?, ?, ...)"
     */
    private String buildInsertSql(String tableName, int numWinners) {
        StringBuilder cols = new StringBuilder();
        StringBuilder placeholders = new StringBuilder();
        for (int i = 1; i <= numWinners; i++) {
            if (i > 1) {
                cols.append(", ");
                placeholders.append(", ");
            }
            cols.append("winner").append(i);
            placeholders.append("?");
        }
        return "INSERT INTO " + tableName + " (" + cols + ") VALUES (" + placeholders + ")";
    }
}