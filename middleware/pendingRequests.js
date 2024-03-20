// middleware/pendingRequests.js
const { getPendingRequestCount } = require('../utils/utils');

async function attachPendingRequestCount(req, res, next) {
    if (req.user) {
        res.locals.pendingRequestCount = await getPendingRequestCount(req.user.id);
    } else {
        res.locals.pendingRequestCount = 0;
    }
    next();
}

module.exports = attachPendingRequestCount;
