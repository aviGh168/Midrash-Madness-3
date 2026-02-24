package spring.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import spring.model.BracketSubmitRequest;
import spring.model.Midrash;
import spring.service.BracketService;

import java.util.List;
import java.util.Map;

/**
 * REST controller for bracket operations.
 * <p>
 * Endpoints:
 *   GET  /api/bracket/midrashim  — returns all 64 midrashim as JSON
 *   POST /api/bracket/submit     — accepts a completed bracket submission
 */
@RestController
@RequestMapping("/api/bracket")
public class BracketController {

    private final BracketService bracketService;

    public BracketController(BracketService bracketService) {
        this.bracketService = bracketService;
    }

    /**
     * Returns all 64 midrashim for the frontend to populate the bracket.
     * Response is a JSON array of Midrash objects ordered by group then seed.
     */
    @GetMapping("/midrashim")
    public ResponseEntity<List<Midrash>> getMidrashim() {
        try {
            List<Midrash> midrashim = bracketService.getAllMidrashim();
            return ResponseEntity.ok(midrashim);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Accepts a completed bracket submission.
     * <p>
     * Expected JSON body (see BracketSubmitRequest for full schema):
     * {
     *   "name": "...",
     *   "email": "...",
     *   "round1Winners": [32 midrash_ids],
     *   "round2Winners": [16 midrash_ids],
     *   "round3Winners": [8  midrash_ids],
     *   "round4Winners": [4  midrash_ids],
     *   "round5Winners": [2  midrash_ids],
     *   "round6Winners": [1  midrash_id]
     * }
     * <p>
     * Returns:
     *   200 OK             on success
     *   400 Bad Request    if the request body is malformed or incomplete
     *   409 Conflict       if the email has already submitted a bracket
     *   500 Internal Error on unexpected server failure
     */
    @PostMapping("/submit")
    public ResponseEntity<Map<String, String>> submitBracket(@RequestBody BracketSubmitRequest request) {
        try {
            bracketService.submitBracket(request);
            return ResponseEntity.ok(Map.of("message", "Bracket submitted successfully."));

        } catch (BracketService.DuplicateEmailException e) {
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));

        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));

        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "An unexpected error occurred. Please try again."));
        }
    }
}