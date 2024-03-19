const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Bet, User } = require('../models'); // Adjust the path as necessary
const { logEvent } = require('../utils/eventLogger');


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

    // const users = await User.findAll();

    res.render('createBet', { user: req.user, users });
});

// Route to post a new bet
router.post('/create', isAuthenticated, async (req, res) => {
    const { initiatorUserId, opponentUserId, judgeUserId, betTitle, betDescription, stake } = req.body;
    await Bet.create({
        initiatorUserId,
        opponentUserId,
        judgeUserId,
        betTitle,
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

    try {
        const bet = await Bet.findOne({ where: { betId }, include: ['Initiator', 'Opponent', 'Judge'] });
        if (!bet) {
            return res.status(404).send('Bet not found');
        }

        if (req.user.id !== bet.judgeUserId) {
            return res.status(403).send('You are not authorized to judge this bet');
        }

        const loserUserId = (winnerUserId == bet.initiatorUserId) ? bet.opponentUserId : bet.initiatorUserId;
        const winner = await User.findByPk(winnerUserId);
        const loser = await User.findByPk(loserUserId);

        // Update the winner's REP points
        await User.increment({ rep: bet.stake }, { where: { id: winnerUserId } });

        // Assign the stake as BAK to the loser's profile
        await User.increment({ bak: bet.stake }, { where: { id: loserUserId } });

        // Mark the bet as completed with the winner declared
        await Bet.update({ winnerUserId, status: 'completed' }, { where: { betId } });

        // Log event for the winner
        await logEvent({
            userId: winnerUserId,
            description: `Won bet ${bet.betTitle}. Awarded ${bet.stake} REP points. Gewonnen van ${loser.name}`
        });

        // Log event for the loser
        await logEvent({
            userId: loserUserId,
            description: `Lost bet ${bet.betTitle}. Assigned ${bet.stake} BAKs. Verloren van ${winner.name}`
        });

        res.redirect('/bets');
    } catch (error) {
        console.error('Error updating the bet:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
