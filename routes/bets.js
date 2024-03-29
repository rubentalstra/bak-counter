const express = require('express');

const { Op } = require('sequelize');
const { Bet, User } = require('../models'); // Adjust the path as necessary
const { logEvent } = require('../utils/eventLogger');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();


// Route to view all bets
router.get('/', rateLimiter, async (req, res) => {
    const bets = await Bet.findAll({
        include: ['Initiator', 'Opponent', 'Judge'],
        order: [['createdAt', 'DESC']],
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
router.get('/create', rateLimiter, async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;

        //  Fetch all users to select as opponent and judge
        const users = await User.findAll({
            where: {
                id: {
                    [Op.not]: req.user.id
                }
            }
        });

        // Render the create request page with the users data
        res.render('bets/create', { csrfToken: req.csrfToken(), user: req.user, users, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error('Error fetching users for Create new Bet request:', error);
        res.status(500).send('Error fetching data');
    }

});

// Route to post a new bet
router.post('/create', async (req, res) => {
    const { opponentUserId, judgeUserId, betTitle, betDescription, stake } = req.body;

    const loggedInUserId = parseInt(req.user.id, 10); // Zet naar integer
    const intOpponentUserId = parseInt(opponentUserId, 10); // Zet naar integer
    const intJudgeUserId = parseInt(judgeUserId, 10); // Zet naar integer

    if (isNaN(intOpponentUserId) || isNaN(intJudgeUserId)) {
        const errorMessage = "Zowel de tegenstander als de scheidsrechter moeten worden opgegeven.";
        return res.redirect(`/bets/create?errorMessage=${encodeURIComponent(errorMessage)}`);
    }

    if (loggedInUserId === intJudgeUserId || intJudgeUserId === intOpponentUserId) {
        const errorMessage = 'De scheidsrechter moet een neutrale derde partij zijn en kan niet dezelfde zijn als de tegenstander van de weddenschap.';
        return res.redirect(`/bets/create?errorMessage=${encodeURIComponent(errorMessage)}`);
    }


    try {
        const newBet = await Bet.create({
            initiatorUserId: loggedInUserId,
            opponentUserId: intOpponentUserId,
            judgeUserId: intJudgeUserId,
            betTitle,
            betDescription,
            stake,
            status: 'pending'
        });

        const betWithUsers = await Bet.findByPk(newBet.betId, {
            include: [
                { model: User, as: 'Initiator', attributes: ['name'] },
                { model: User, as: 'Opponent', attributes: ['name'] },
                { model: User, as: 'Judge', attributes: ['name'] }
            ]
        });

        // Logboeking voor de initiator
        await logEvent({
            userId: loggedInUserId,
            description: `Heeft een nieuwe weddenschap aangemaakt: "${betTitle}" tegen ${betWithUsers.Opponent.name} met ${betWithUsers.Judge.name} als scheidsrechter. Inzet: ${stake}.`
        });
        // Logboeking voor de tegenstander
        await logEvent({
            userId: intOpponentUserId,
            description: `Is uitgedaagd door ${betWithUsers.Initiator.name} voor de weddenschap "${betTitle}". ${betWithUsers.Judge.name} is de scheidsrechter. Inzet: ${stake}.`
        });
        // Logboeking voor de scheidsrechter
        await logEvent({
            userId: intJudgeUserId,
            description: `Is aangewezen als scheidsrechter voor de weddenschap "${betTitle}" tussen ${betWithUsers.Initiator.name} en ${betWithUsers.Opponent.name}. Inzet: ${stake}.`
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

        if (parseInt(req.user.id) !== parseInt(bet.judgeUserId)) {
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
        if (winner) {
            winner.rep += bet.stake;
            await winner.save();
        }

        // Assign the stake as BAK to the loser's profile
        if (loser) {
            loser.bak += bet.stake;
            await loser.save();
        }

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
            description: `Heeft de weddenschap ${bet.betTitle} verloren. ${bet.stake} ${bet.stake === 1 ? 'Bak' : 'Bakken'} toegewezen. Verloren van ${winner.name}`
        });


        res.redirect('/bets');
    } catch (error) {
        console.error('Error updating the bet:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
