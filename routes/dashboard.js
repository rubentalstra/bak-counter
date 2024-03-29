const express = require('express');
const { BakRequest, User, BakHasTakenRequest, EventLog } = require('../models');
const { getUserReputationDetails, getUserLevelDetails } = require('../utils/levelUtils');
const rateLimiter = require('../middleware/rateLimiter');
const router = express.Router();



router.get('/dashboard', rateLimiter, async (req, res) => {
    try {
        const [users, topUsersByXp, topUsersByRep] = await Promise.all([
            User.findAll({
                attributes: ['id', 'name', 'bak', 'xp', 'profilePicture'],
                include: [
                    {
                        model: BakRequest,
                        as: 'BakRequests',
                        where: { status: 'pending' },
                        required: false
                    },
                    {
                        model: BakHasTakenRequest,
                        as: 'ReceivedProposals',
                        where: { status: 'pending' },
                        required: false
                    }
                ]
            }),
            fetchTopUsers('xp'),
            fetchTopUsers('rep'),
        ]);

        res.render('dashboard', { user: req.user, users, topUsersByXp, topUsersByRep });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/eventLogs', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const { count, rows: eventLogs } = await EventLog.findAndCountAll({
            include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.render('eventLogs', { user: req.user, eventLogs, currentPage: page, totalPages: Math.ceil(count / limit) });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


async function fetchTopUsers(attribute) {
    const users = await User.findAll({
        attributes: ['id', 'name', 'profilePicture', attribute],
        order: [[attribute, 'DESC']],
        limit: 5
    });

    return users.map(user => ({
        ...user.get({ plain: true }),
        ...attribute === 'xp' ? getUserLevelDetails(user.xp) : getUserReputationDetails(user.rep),
    }));
}




module.exports = router;
