const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Bet, User } = require('../models'); // Adjust the path as necessary


// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

// Route to display form to create a new bet
router.get('/create', isAuthenticated, async (req, res) => {


    //  Fetch all users to select as opponent and judge
    const users = await User.findAll({
        where: {
            id: {
                [Op.not]: req.user.id // Exclude current user's ID
            }
        }
    });

    res.render('createBet', { user: req.user, users });
});

// Route to post a new bet
router.post('/create', isAuthenticated, async (req, res) => {
    const { initiatorUserId, opponentUserId, judgeUserId, betDescription, stake } = req.body;
    await Bet.create({
        initiatorUserId,
        opponentUserId,
        judgeUserId,
        betDescription,
        stake,
        status: 'pending'
    });
    res.redirect('/bets');
});

// Route to view all bets
router.get('/', isAuthenticated, async (req, res) => {
    const bets = await Bet.findAll({
        include: ['Initiator', 'Opponent', 'Judge']
    });
    res.render('viewBets', { user: req.user, bets });
});

// Route for the judge to declare a winner
router.post('/judge/:betId', isAuthenticated, async (req, res) => {
    const { betId } = req.params;
    const { winnerUserId } = req.body;
    await Bet.update({ winnerUserId, status: 'completed' }, { where: { betId } });
    res.redirect('/bets');
});

module.exports = router;
