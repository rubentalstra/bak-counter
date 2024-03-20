// middleware/pendingBets.js
const { getPendingBetCount } = require('../utils/utils');

async function attachPendingBetCount(req, res, next) {
    if (req.user) {
        res.locals.pendingBetCount = await getPendingBetCount(req.user.id);
    } else {
        res.locals.pendingBetCount = 0;
    }
    next();
}

module.exports = attachPendingBetCount;