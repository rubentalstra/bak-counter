// middleware/pendingRequests.js
const { getPendingRequestCount } = require('../utils/utils');

async function attachPendingRequestCount(req, res, next) {
    // Check if we've already fetched this data for the current request
    if (!req.attachPendingRequestCount) {
        if (req.user) {
            try {
                res.locals.pendingRequestCount = await getPendingRequestCount(req.user.id);
                req.attachPendingRequestCount = true; // Mark as fetched
            } catch (error) {
                console.error('Error fetching pending request count:', error);
            }
        } else {
            res.locals.pendingRequestCount = 0;
        }
    }
    next();
}

module.exports = attachPendingRequestCount;