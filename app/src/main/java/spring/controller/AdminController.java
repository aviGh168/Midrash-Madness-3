package spring.controller;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import spring.model.AdminBracketSummary;
import spring.model.UserBracketResponse;
import spring.service.UserBracketService;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;

/**
 * REST controller for admin-only operations.
 * <p>
 * Every endpoint requires the admin password to be supplied in the
 * {@code X-Admin-Password} request header. This means the client-side
 * password gate cannot be bypassed by calling the API directly.
 * <p>
 * Endpoints:
 * <ul>
 *   <li>POST /api/admin/auth          — validates the password; 200 OK or 401 Unauthorized</li>
 *   <li>GET  /api/admin/brackets      — returns all submitted brackets (bracket_id + name),
 *                                       sorted alphabetically by name</li>
 *   <li>GET  /api/admin/brackets/{id} — returns the full bracket for one bracket_id,
 *                                       gated by the admin password</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final String PASSWORD_HEADER = "X-Admin-Password";

    private final String             adminPassword;
    private final JdbcTemplate       jdbc;
    private final UserBracketService userBracketService;

    public AdminController(@Qualifier("adminPassword") String adminPassword,
                           DataSource dataSource,
                           UserBracketService userBracketService) {
        this.adminPassword      = adminPassword;
        this.jdbc               = new JdbcTemplate(dataSource);
        this.userBracketService = userBracketService;
    }

    // ─── Auth ─────────────────────────────────────────────────────────────────

    /**
     * Validates the admin password.
     * <p>
     * The frontend calls this once when the admin submits the password form.
     * A 200 response means the password is correct; the frontend then stores
     * it in memory and sends it with every subsequent admin request.
     * <p>
     * Returns:
     *   200 OK             if the password matches
     *   401 Unauthorized   if the password is wrong or the header is absent
     */
    @PostMapping("/auth")
    public ResponseEntity<Map<String, String>> authenticate(
            @RequestHeader(value = PASSWORD_HEADER, required = false) String supplied) {

        if (supplied == null || !supplied.equals(adminPassword)) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Incorrect password."));
        }
        return ResponseEntity.ok(Map.of("message", "Authenticated."));
    }

    // ─── Bracket list ──────────────────────────────────────────────────────────

    /**
     * Returns all completed brackets as a list of {bracket_id, name} objects,
     * sorted alphabetically by the submitter's name.
     * <p>
     * Requires the {@code X-Admin-Password} header to match the configured password.
     * <p>
     * Returns:
     *   200 OK             with JSON array of AdminBracketSummary
     *   401 Unauthorized   if the password header is absent or incorrect
     *   500 Internal Error on unexpected server failure
     */
    @GetMapping("/brackets")
    public ResponseEntity<?> getBrackets(
            @RequestHeader(value = PASSWORD_HEADER, required = false) String supplied) {

        if (supplied == null || !supplied.equals(adminPassword)) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized."));
        }

        try {
            String sql =
                    "SELECT cb.bracket_id, u.name " +
                            "FROM completed_bracket cb " +
                            "JOIN midrash_users u ON u.user_id = cb.user_id " +
                            "ORDER BY u.name ASC";

            List<AdminBracketSummary> summaries = jdbc.query(sql, (rs, rowNum) ->
                    new AdminBracketSummary(
                            rs.getInt("bracket_id"),
                            rs.getString("name")
                    )
            );

            return ResponseEntity.ok(summaries);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "An unexpected error occurred."));
        }
    }

    // ─── Single bracket (gated) ────────────────────────────────────────────────

    /**
     * Returns the full bracket for the given bracket_id, gated by the admin password.
     * <p>
     * The admin page calls this endpoint instead of the open
     * {@code GET /api/bracket/user/{bracketId}} so that individual bracket data
     * is not accessible without the password. Sequential bracket IDs are trivially
     * enumerable, so fetching them must be protected even if the list endpoint is.
     * <p>
     * Delegates to {@link UserBracketService#getBracketById(int)} — same logic and
     * response shape as {@code UserBracketController}, just behind the password gate.
     * <p>
     * Returns:
     *   200 OK             with UserBracketResponse body if found
     *   400 Bad Request    if bracketId is not a positive integer
     *   401 Unauthorized   if the password header is absent or incorrect
     *   404 Not Found      if no bracket exists with that id
     *   500 Internal Error on unexpected server failure
     */
    @GetMapping("/brackets/{bracketId}")
    public ResponseEntity<?> getBracketById(
            @RequestHeader(value = PASSWORD_HEADER, required = false) String supplied,
            @PathVariable int bracketId) {

        if (supplied == null || !supplied.equals(adminPassword)) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized."));
        }
        if (bracketId <= 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "bracketId must be a positive integer."));
        }

        try {
            UserBracketResponse bracket = userBracketService.getBracketById(bracketId);
            if (bracket == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No bracket found with id " + bracketId + "."));
            }
            return ResponseEntity.ok(bracket);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "An unexpected error occurred."));
        }
    }
}