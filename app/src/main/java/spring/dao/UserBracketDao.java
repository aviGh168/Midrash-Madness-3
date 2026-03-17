package spring.dao;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import spring.model.UserBracketResponse;

import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object for fetching a single user's completed bracket.
 * <p>
 * The completed_bracket table links a user to one row in each of the six
 * round tables. This DAO joins through completed_bracket → midrash_users and
 * all six round tables to retrieve the submitter's name and every winner they
 * picked, ordered exactly as the frontend expects:
 * <ul>
 *   <li>round_1: winner1..winner32</li>
 *   <li>round_2: winner1..winner16</li>
 *   <li>round_3: winner1..winner8</li>
 *   <li>round_4: winner1..winner4</li>
 *   <li>round_5: winner1..winner2</li>
 *   <li>round_6: winner1 (champion)</li>
 * </ul>
 */
@Repository
public class UserBracketDao {

    private final JdbcTemplate jdbc;

    public UserBracketDao(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /**
     * Fetches the completed bracket for the given bracket_id.
     * <p>
     * Returns null if no bracket exists with that id.
     *
     * @param bracketId the primary key of the completed_bracket row
     * @return populated UserBracketResponse, or null if not found
     */
    public UserBracketResponse getBracketById(int bracketId) {
        // Single query: join completed_bracket to the user and all 6 round tables.
        // LEFT JOIN is used for each round table so a NULL round_X_id (shouldn't
        // happen in valid data, but is defensive) does not drop the row.
        String sql =
                "SELECT " +
                        "    cb.bracket_id, " +
                        "    u.name, " +
                        "    r1.winner1  AS r1w1,  r1.winner2  AS r1w2,  r1.winner3  AS r1w3,  r1.winner4  AS r1w4, " +
                        "    r1.winner5  AS r1w5,  r1.winner6  AS r1w6,  r1.winner7  AS r1w7,  r1.winner8  AS r1w8, " +
                        "    r1.winner9  AS r1w9,  r1.winner10 AS r1w10, r1.winner11 AS r1w11, r1.winner12 AS r1w12, " +
                        "    r1.winner13 AS r1w13, r1.winner14 AS r1w14, r1.winner15 AS r1w15, r1.winner16 AS r1w16, " +
                        "    r1.winner17 AS r1w17, r1.winner18 AS r1w18, r1.winner19 AS r1w19, r1.winner20 AS r1w20, " +
                        "    r1.winner21 AS r1w21, r1.winner22 AS r1w22, r1.winner23 AS r1w23, r1.winner24 AS r1w24, " +
                        "    r1.winner25 AS r1w25, r1.winner26 AS r1w26, r1.winner27 AS r1w27, r1.winner28 AS r1w28, " +
                        "    r1.winner29 AS r1w29, r1.winner30 AS r1w30, r1.winner31 AS r1w31, r1.winner32 AS r1w32, " +
                        "    r2.winner1  AS r2w1,  r2.winner2  AS r2w2,  r2.winner3  AS r2w3,  r2.winner4  AS r2w4, " +
                        "    r2.winner5  AS r2w5,  r2.winner6  AS r2w6,  r2.winner7  AS r2w7,  r2.winner8  AS r2w8, " +
                        "    r2.winner9  AS r2w9,  r2.winner10 AS r2w10, r2.winner11 AS r2w11, r2.winner12 AS r2w12, " +
                        "    r2.winner13 AS r2w13, r2.winner14 AS r2w14, r2.winner15 AS r2w15, r2.winner16 AS r2w16, " +
                        "    r3.winner1  AS r3w1,  r3.winner2  AS r3w2,  r3.winner3  AS r3w3,  r3.winner4  AS r3w4, " +
                        "    r3.winner5  AS r3w5,  r3.winner6  AS r3w6,  r3.winner7  AS r3w7,  r3.winner8  AS r3w8, " +
                        "    r4.winner1  AS r4w1,  r4.winner2  AS r4w2,  r4.winner3  AS r4w3,  r4.winner4  AS r4w4, " +
                        "    r5.winner1  AS r5w1,  r5.winner2  AS r5w2, " +
                        "    r6.winner1  AS r6w1 " +
                        "FROM completed_bracket cb " +
                        "JOIN midrash_users u   ON u.user_id       = cb.user_id " +
                        "LEFT JOIN round_1  r1  ON r1.r1_id        = cb.round_1_id " +
                        "LEFT JOIN round_2  r2  ON r2.r2_id        = cb.round_2_id " +
                        "LEFT JOIN round_3  r3  ON r3.r3_id        = cb.round_3_id " +
                        "LEFT JOIN round_4  r4  ON r4.r4_id        = cb.round_4_id " +
                        "LEFT JOIN round_5  r5  ON r5.r5_id        = cb.round_5_id " +
                        "LEFT JOIN round_6  r6  ON r6.r6_id        = cb.round_6_id " +
                        "WHERE cb.bracket_id = ?";

        try {
            return jdbc.queryForObject(sql, (rs, rowNum) -> {
                UserBracketResponse resp = new UserBracketResponse();
                resp.setBracketId(rs.getInt("bracket_id"));
                resp.setName(rs.getString("name"));

                // Round 1 — 32 winners
                List<Integer> r1 = new ArrayList<>(32);
                for (int i = 1; i <= 32; i++) {
                    int val = rs.getInt("r1w" + i);
                    r1.add(rs.wasNull() ? null : val);
                }
                resp.setRound1Winners(r1);

                // Round 2 — 16 winners
                List<Integer> r2 = new ArrayList<>(16);
                for (int i = 1; i <= 16; i++) {
                    int val = rs.getInt("r2w" + i);
                    r2.add(rs.wasNull() ? null : val);
                }
                resp.setRound2Winners(r2);

                // Round 3 — 8 winners
                List<Integer> r3 = new ArrayList<>(8);
                for (int i = 1; i <= 8; i++) {
                    int val = rs.getInt("r3w" + i);
                    r3.add(rs.wasNull() ? null : val);
                }
                resp.setRound3Winners(r3);

                // Round 4 — 4 winners
                List<Integer> r4 = new ArrayList<>(4);
                for (int i = 1; i <= 4; i++) {
                    int val = rs.getInt("r4w" + i);
                    r4.add(rs.wasNull() ? null : val);
                }
                resp.setRound4Winners(r4);

                // Round 5 — 2 winners
                List<Integer> r5 = new ArrayList<>(2);
                for (int i = 1; i <= 2; i++) {
                    int val = rs.getInt("r5w" + i);
                    r5.add(rs.wasNull() ? null : val);
                }
                resp.setRound5Winners(r5);

                // Round 6 — 1 winner (champion)
                List<Integer> r6 = new ArrayList<>(1);
                int champVal = rs.getInt("r6w1");
                r6.add(rs.wasNull() ? null : champVal);
                resp.setRound6Winners(r6);

                return resp;
            }, bracketId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }
}