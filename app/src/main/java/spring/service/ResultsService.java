package spring.service;

import org.springframework.stereotype.Service;
import spring.dao.ResultsDao;
import spring.model.MidrashPointTotal;

import java.util.List;

/**
 * Service layer for results-page operations.
 * Delegates to ResultsDao; exists for consistency with the project's layered architecture
 * and to provide a place for any future business logic (e.g. caching, filtering).
 */
@Service
public class ResultsService {

    private final ResultsDao resultsDao;

    public ResultsService(ResultsDao resultsDao) {
        this.resultsDao = resultsDao;
    }

    /**
     * Returns point totals for all 64 midrashim.
     * All midrashim are included, even those with zero points.
     *
     * @return list of MidrashPointTotal, one per midrash
     */
    public List<MidrashPointTotal> getPointTotals() {
        return resultsDao.getPointTotals();
    }
}