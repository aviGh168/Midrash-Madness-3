package spring.service;

import org.springframework.stereotype.Service;
import spring.dao.UserBracketDao;
import spring.model.UserBracketResponse;

/**
 * Service layer for user bracket retrieval.
 * Delegates to UserBracketDao; exists for consistency with the project's
 * layered architecture and to provide a place for any future business logic.
 */
@Service
public class UserBracketService {

    private final UserBracketDao userBracketDao;

    public UserBracketService(UserBracketDao userBracketDao) {
        this.userBracketDao = userBracketDao;
    }

    /**
     * Returns the completed bracket for the given bracket_id,
     * or null if no such bracket exists.
     *
     * @param bracketId the primary key of the completed_bracket row
     * @return populated UserBracketResponse, or null if not found
     */
    public UserBracketResponse getBracketById(int bracketId) {
        return userBracketDao.getBracketById(bracketId);
    }
}