package spring.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.model.MidrashPointTotal;
import spring.service.ResultsService;

import java.util.List;

/**
 * REST controller for the results page.
 * <p>
 * Endpoints:
 *   GET /api/results/points — returns point totals for all 64 midrashim
 */
@RestController
@RequestMapping("/api/results")
public class ResultsController {

    private final ResultsService resultsService;

    public ResultsController(ResultsService resultsService) {
        this.resultsService = resultsService;
    }

    /**
     * Returns point totals for all 64 midrashim.
     * <p>
     * A "point" is earned each time a midrash_id appears in any round winner column.
     * Points are broken down by round (r1 through r6) and include:
     *   - total: sum across all rounds
     *   - r1..r6: points earned in that specific round
     *   - max_round: the highest round number in which this midrash appeared (0 if never)
     * <p>
     * Response is a JSON array of MidrashPointTotal objects.
     * All 64 midrashim are always returned, even those with 0 points.
     */
    @GetMapping("/points")
    public ResponseEntity<List<MidrashPointTotal>> getPointTotals() {
        try {
            List<MidrashPointTotal> totals = resultsService.getPointTotals();
            return ResponseEntity.ok(totals);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}