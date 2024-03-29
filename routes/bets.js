const express = require('express');

const { Op } = require('sequelize');
const { Bet, User } = require('../models'); // Adjust the path as necessary
const { logEvent } = require('../utils/eventLogger');
const rateLimiter = require('../middleware/rateLimiter');
const ApplicationError = require('../utils/ApplicationError');


const router = express.Router();


// Route to view all bets
router.get('/', rateLimiter, async (req, res, next) => {
    try {
        const bets = await Bet.findAll({
            include: ['Initiator', 'Opponent', 'Judge'],
            order: [['createdAt', 'DESC']],
        });

        res.render('bets/view', { csrfToken: req.csrfToken(), user: req.user, bets });
    } catch (error) {
        console.error('Error fetching bets:', error);
        next(new ApplicationError('Error fetching bets', 500));
    }
});


router.post('/approve/:betId', async (req, res, next) => {
    const { betId } = req.params;

    try {
        const bet = await Bet.findOne({ where: { betId } });

        if (!bet) {
            throw new ApplicationError('Bet not found', 404);
        }

        if (parseInt(req.user.id) !== parseInt(bet.opponentUserId)) {
            throw new ApplicationError('You are not authorized to approve this bet', 403);
        }

        await bet.update({ opponentApproval: true });
        res.redirect('/bets');
    } catch (error) {
        console.error("Error approving the bet:", error);
        next(error);
    }

});

router.post('/decline/:betId', async (req, res, next) => {
    const { betId } = req.params;

    try {
        const bet = await Bet.findOne({ where: { betId } });

        if (!bet) {
            throw new ApplicationError('Bet not found', 404);
        }

        if (parseInt(req.user.id) !== parseInt(bet.opponentUserId)) {
            throw new ApplicationError('You are not authorized to decline this bet', 403);
        }

        // Update the bet status to 'declined'
        await bet.update({ status: 'declined' });

        // Redirect or send a response
        res.redirect('/bets');
    } catch (error) {
        console.error("Error declining the bet:", error);
        next(error); // Pass the ApplicationError or any other error to the global error handler
    }
});



// Route to display form to create a new bet
router.get('/create', rateLimiter, async (req, res, next) => {
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
        next(new ApplicationError('Error fetching data for creating a new bet', 500));
    }
});

// Route to post a new bet
router.post('/create', async (req, res, next) => {
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
        console.error("Fout bij het aanmaken van de weddenschap:", error);
        next(new ApplicationError('Er is een fout opgetreden bij het verwerken van uw verzoek.', 500));
    }
});





// Route for the judge to declare a winner
router.post('/judge/:betId', async (req, res, next) => {
    const { betId } = req.params;
    const { winnerUserId } = req.body;

    try {
        const bet = await Bet.findOne({ where: { betId }, include: ['Initiator', 'Opponent', 'Judge'] });
        if (!bet) {
            throw new ApplicationError('Bet not found', 404);
        }

        if (parseInt(req.user.id) !== parseInt(bet.judgeUserId)) {
            throw new ApplicationError('You are not authorized to judge this bet', 403);
        }

        // Check if the opponent has approved the bet
        if (!bet.opponentApproval) {
            throw new ApplicationError('The opponent has not approved this bet yet.', 403);
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
        next(error);
    }
});

module.exports = router;
