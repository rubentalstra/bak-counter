const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Bet, User } = require('../models'); // Adjust the path as necessary
const { logEvent } = require('../utils/eventLogger');



// Route to view all bets
router.get('/', async (req, res) => {
    const bets = await Bet.findAll({
        include: ['Initiator', 'Opponent', 'Judge']
    });
    res.render('bets/view', { csrfToken: req.csrfToken(), user: req.user, bets });
});


router.post('/approve/:betId', async (req, res) => {
    const { betId } = req.params;

    try {
        const bet = await Bet.findOne({ where: { betId } });

        if (!bet) {
            return res.status(404).send('Bet not found');
        }

        if (parseInt(req.user.id) !== parseInt(bet.opponentUserId)) {
            return res.status(403).send('You are not authorized to approve this bet');
        }

        await bet.update({ opponentApproval: true });
        res.redirect('/bets');
    } catch (error) {
        console.error("Error approving the bet:", error);
        res.status(500).send("An error occurred while processing your request.");
    }
});

router.post('/decline/:betId', async (req, res) => {
    const { betId } = req.params;

    try {
        const bet = await Bet.findOne({ where: { betId } });

        if (!bet) {
            return res.status(404).send('Bet not found');
        }

        if (parseInt(req.user.id) !== parseInt(bet.opponentUserId)) {
            return res.status(403).send('You are not authorized to decline this bet');
        }

        // Update the bet status to 'declined'
        await bet.update({ status: 'declined' });

        // Redirect or send a response
        res.redirect('/bets');
    } catch (error) {
        console.error("Error declining the bet:", error);
        res.status(500).send("An error occurred while processing your request.");
    }
});



// Route to display form to create a new bet
router.get('/create', async (req, res) => {

    //  Fetch all users to select as opponent and judge
    const users = await User.findAll({
        where: {
            id: {
                [Op.not]: req.user.id // Exclude current user's ID
            }
        }
    });

    // const users = await User.findAll();

    res.render('bets/create', { csrfToken: req.csrfToken(), user: req.user, users });
});

// Route to post a new bet
router.post('/create', async (req, res) => {
    const { opponentUserId, judgeUserId, betTitle, betDescription, stake } = req.body;

    const loggedInUserId = parseInt(req.user.id, 10); // Zet naar integer
    const intOpponentUserId = parseInt(opponentUserId, 10); // Zet naar integer
    const intJudgeUserId = parseInt(judgeUserId, 10); // Zet naar integer

    // Valideer dat de judgeUserId verschilt van initiatorUserId en opponentUserId
    if (loggedInUserId === intJudgeUserId || intJudgeUserId === intOpponentUserId) {
        // Stuur een foutbericht terug als de judge dezelfde is als de initiator of de tegenstander
        return res.status(400).send("De judge moet een neutrale derde partij zijn en kan niet dezelfde zijn als de tegenstander van de weddenschap.");
    }

    try {
        await Bet.create({
            initiatorUserId: loggedInUserId,
            opponentUserId: intOpponentUserId,
            judgeUserId: intJudgeUserId,
            betTitle,
            betDescription,
            stake,
            status: 'pending'
        });
        res.redirect('/bets');
    } catch (error) {
        // Vang eventuele fouten op die optreden tijdens het aanmaken van de weddenschap en stuur een foutbericht terug
        console.error("Fout bij het aanmaken van de weddenschap:", error);
        res.status(500).send("Er is een fout opgetreden bij het verwerken van uw verzoek.");
    }
});





// Route for the judge to declare a winner
router.post('/judge/:betId', async (req, res) => {
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

        // Check if the opponent has approved the bet
        if (!bet.opponentApproval) {
            return res.status(403).send('The opponent has not approved this bet yet.');
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

        // Logboeking voor de winnaar
        await logEvent({
            userId: winnerUserId,
            description: `Heeft de weddenschap ${bet.betTitle} gewonnen. ${bet.stake} REP punten toegekend. Gewonnen van ${loser.name}`
        });

        // Logboeking voor de verliezer
        await logEvent({
            userId: loserUserId,
            description: `Heeft de weddenschap ${bet.betTitle} verloren. ${bet.stake} BAKs toegewezen. Verloren van ${winner.name}`
        });


        res.redirect('/bets');
    } catch (error) {
        console.error('Error updating the bet:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
