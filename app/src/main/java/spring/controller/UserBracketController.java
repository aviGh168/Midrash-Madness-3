package spring.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import spring.model.UserBracketResponse;
import spring.service.UserBracketService;

/**
 * REST controller for fetching a single user's completed bracket.
 * <p>
 * Endpoints:
 *   GET /api/bracket/user/{bracketId} — returns the bracket for the given bracket_id
 */
@RestController
@RequestMapping("/api/bracket")
public class UserBracketController {

    private final UserBracketService userBracketService;

    public UserBracketController(UserBracketService userBracketService) {
        this.userBracketService = userBracketService;
    }

    /**
     * Returns the completed bracket for the given bracket_id.
     * <p>
     * Response is a JSON object with the submitter's name and six round winner arrays.
     * <p>
     * Returns:
     *   200 OK        with UserBracketResponse body if found
     *   400 Bad Request  if bracketId is not a positive integer
     *   404 Not Found    if no bracket exists with that id
     *   500 Internal Error on unexpected server failure
     */
    @GetMapping("/user/{bracketId}")
    public ResponseEntity<UserBracketResponse> getUserBracket(@PathVariable int bracketId) {
        if (bracketId <= 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        try {
            UserBracketResponse bracket = userBracketService.getBracketById(bracketId);
            if (bracket == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            return ResponseEntity.ok(bracket);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}