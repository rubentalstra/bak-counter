const { EventLog } = require('../models');


async function logEvent({ userId = null, description }) {
    try {
        await EventLog.create({
            userId,
            description
        });
    } catch (error) {
        console.error('Failed to log event:', error);
    }
}

module.exports = { logEvent };
