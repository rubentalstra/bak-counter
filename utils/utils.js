// utils/utils.js
const { BakRequest } = require('../models'); // Adjust the path according to your project structure

async function getPendingRequestCount(userId) {
    const count = await BakRequest.count({
        where: {
            targetId: userId,
            status: 'pending'
        }
    });
    return count;
}

module.exports = {
    getPendingRequestCount
};
