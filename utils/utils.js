// utils/utils.js
const { Op } = require('sequelize');
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

async function getPendingBetCount(userId) {
    const count = await Bet.count({
        where: {
            [Op.or]: [
                {
                    judgeUserId: userId,
                    status: 'pending',
                    opponentApproval: true
                },
                {
                    opponentUserId: userId,
                    status: 'pending',
                    opponentApproval: false
                }
            ]
        }
    });
    return count;
}

module.exports = {
    getPendingRequestCount,
    getPendingBetCount
};
