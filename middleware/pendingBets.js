// middleware/pendingBets.js
const { getPendingBetCount } = require('../utils/utils');

async function attachPendingBetCount(req, res, next) {
    // Check if we've already fetched this data for the current request
    if (!req.attachPendingBetCount) {
        if (req.user) {
            try {
                res.locals.pendingBetCount = await getPendingBetCount(req.user.id);
                req.attachPendingBetCount = true; // Mark as fetched
            } catch (error) {
                console.error('Error fetching pending request count:', error);
            }
        } else {
            res.locals.pendingBetCount = 0;
        }
    }
    next();
}

module.exports = attachPendingBetCount;