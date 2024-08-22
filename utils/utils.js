// utils/utils.js
const { Op } = require('sequelize');
const { Bet, BakRequest } = require('../models');

async function getPendingRequestCount(userId) {
    return await BakRequest.count({
        where: {
            targetId: userId,
            status: 'pending'
        }
    });
}

async function getPendingBetCount(userId) {
    return await Bet.count({
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
}

module.exports = {
    getPendingRequestCount,
    getPendingBetCount
};
