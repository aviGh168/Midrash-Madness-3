package spring.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import spring.dao.BracketDao;
import spring.model.BracketSubmitRequest;
import spring.model.Midrash;

import java.util.List;

/**
 * Service layer for bracket operations.
 * Validates requests and orchestrates database writes via BracketDao.
 * The full submission is wrapped in a transaction so it either fully succeeds
 * or is fully rolled back.
 */
@Service
public class BracketService {

    private final BracketDao bracketDao;

    public BracketService(BracketDao bracketDao) {
        this.bracketDao = bracketDao;
    }

    /**
     * Returns all 64 midrashim for the frontend to build the bracket.
     */
    public List<Midrash> getAllMidrashim() {
        return bracketDao.getAllMidrashim();
    }

    /**
     * Validates and persists a completed bracket submission, then sends a
     * confirmation email to the submitter.
     * <p>
     * The database writes are wrapped in a transaction; the email is sent
     * <em>after</em> the transaction commits so that an email failure never
     * rolls back a successfully saved bracket.
     *
     * @param request the fully populated submission from the frontend
     * @return the generated bracket_id for the new completed_bracket row
     * @throws DuplicateEmailException  if the email has already submitted a bracket
     * @throws IllegalArgumentException if the round winner lists are malformed
     */
    @Transactional
    public int submitBracket(BracketSubmitRequest request) {
        validateRequest(request);

        // Reject duplicate emails
        if (bracketDao.userEmailExists(request.getEmail())) {
            throw new DuplicateEmailException("A bracket has already been submitted for email: " + request.getEmail());
        }

        // Persist user
        int userId = bracketDao.insertUser(request.getName(), request.getEmail());

        // Persist each round in order and capture generated IDs
        int r1Id = bracketDao.insertRound1(request.getRound1Winners());
        int r2Id = bracketDao.insertRound2(request.getRound2Winners());
        int r3Id = bracketDao.insertRound3(request.getRound3Winners());
        int r4Id = bracketDao.insertRound4(request.getRound4Winners());
        int r5Id = bracketDao.insertRound5(request.getRound5Winners());
        int r6Id = bracketDao.insertRound6(request.getRound6Winners().getFirst());

        // Link everything together in completed_bracket and return the new bracket_id
        return bracketDao.insertCompletedBracket(userId, r1Id, r2Id, r3Id, r4Id, r5Id, r6Id);
    }

    // ─── Validation ───────────────────────────────────────────────────────────

    private void validateRequest(BracketSubmitRequest request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Name is required.");
        }
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (!request.getEmail().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new IllegalArgumentException("Invalid email address format.");
        }
        validateWinnerList(request.getRound1Winners(), 32, "round1Winners");
        validateWinnerList(request.getRound2Winners(), 16, "round2Winners");
        validateWinnerList(request.getRound3Winners(),  8, "round3Winners");
        validateWinnerList(request.getRound4Winners(),  4, "round4Winners");
        validateWinnerList(request.getRound5Winners(),  2, "round5Winners");
        validateWinnerList(request.getRound6Winners(),  1, "round6Winners");
    }

    private void validateWinnerList(List<Integer> list, int expectedSize, String fieldName) {
        if (list == null || list.size() != expectedSize) {
            throw new IllegalArgumentException(
                    fieldName + " must contain exactly " + expectedSize + " entries."
            );
        }
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i) == null) {
                throw new IllegalArgumentException(
                        fieldName + " has a null entry at index " + i + ". All matchups must have a winner."
                );
            }
        }
    }

    // ─── Exception Types ──────────────────────────────────────────────────────

    /**
     * Thrown when a submission is attempted with an email that already exists.
     */
    public static class DuplicateEmailException extends RuntimeException {
        public DuplicateEmailException(String message) {
            super(message);
        }
    }
}