// utils/utils.js
const { Bet, BakRequest } = require('../models');

async function getPendingRequestCount(userId) {
    const count = await BakRequest.count({
        where: {
            targetId: userId,
            status: 'pending'
        }
    });
    return count;
}

async function getPendingBetCount(judgeUserId) {
    const count = await Bet.count({
        where: {
            judgeUserId: judgeUserId,
            status: 'pending'
        }
    });
    return count;
}


module.exports = {
    getPendingRequestCount,
    getPendingBetCount
};
