const express = require('express');

const { User, BakRequest } = require('../models');
const { Op } = require('sequelize');
const { logEvent } = require('../utils/eventLogger');
const ApplicationError = require('../utils/ApplicationError');
const rateLimiter = require('../middleware/rateLimiter');
const router = express.Router();


router.get('/submit', rateLimiter, async (req, res, next) => {
    try {
        const errorMessage = req.query.errorMessage;

        // Fetch all users except the current user
        const users = await User.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.not]: req.user.id } }
        });

        res.render('bak-send-recieve/submit', { csrfToken: req.csrfToken(), user: req.user, users, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error("Error Get BAK:", error);
        next(new ApplicationError('Internal Server Error', 500));
    }
});



router.post('/submit', async (req, res, next) => {
    try {
        const { targetId, reasonBak } = req.body;
        const requesterId = req.user.id;

        // Check if requesterId and targetId are the same
        if (parseInt(requesterId) === parseInt(targetId)) {
            const errorMessage = 'You cannot send a BAK request to yourself.';
            return res.redirect(`/submit?errorMessage=${encodeURIComponent(errorMessage)}`);
        }

        // Retrieve both requester and target user details
        const requester = await User.findByPk(requesterId);
        const target = await User.findByPk(targetId);

        if (!requester || !target) {
            const errorMessage = 'Gebruiker niet gevonden.';
            return res.redirect(`/submit?errorMessage=${encodeURIComponent(errorMessage)}`);
        }


        // Continue with BAK request creation
        await BakRequest.create({
            requesterId,
            targetId,
            reasonBak,
            status: 'pending'
        });

        // Log event for the requester
        await logEvent({
            userId: requesterId,
            description: `Heeft een BAK verzoek gestuurd naar ${target.name} met reden: ${reasonBak}.`
        });

        // Log event for the target
        await logEvent({
            userId: targetId,
            description: `Heeft een BAK verzoek ontvangen van ${requester.name} met reden: ${reasonBak}.`
        });


        res.redirect('/dashboard');
    } catch (error) {
        console.error("Error submitting BAK:", error);
        next(new ApplicationError('Error submitting BAK', 500));
    }
});



router.get('/validate', rateLimiter, async (req, res, next) => {
    const requesterId = req.user.id;

    try {
        const bakRequests = await BakRequest.findAll({
            where: { targetId: requesterId, status: 'pending' },
            include: [{ model: User, as: 'Requester', attributes: ['name'] }]
        });

        res.render('bak-send-recieve/validate', { csrfToken: req.csrfToken(), user: req.user, bakRequests });
    } catch (error) {
        console.error("Error fetching BAK requests:", error);
        next(new ApplicationError('Error fetching BAK requests', 500));
    }
});

router.post('/validate/:requestId/:status', async (req, res, next) => {
    const { requestId, status } = req.params;
    try {
        const request = await BakRequest.findByPk(requestId, {
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] }
            ]
        });

        if (!request) {
            throw new ApplicationError('Request not found', 404);
        }

        const requesterName = request.Requester.name;
        const targetName = request.Target.name;

        // Check if the user is authorized to update the request
        if (request.targetId !== req.user.id) {
            throw new ApplicationError('Not authorized', 403);
        }

        // Update request status
        request.status = status;
        await request.save();

        // Update BAK counts based on request status
        if (status === 'approved') {
            // Als het verzoek is goedgekeurd, verhoog de BAK-telling van de doelgebruiker
            const targetUser = await User.findByPk(request.targetId);
            targetUser.bak++;
            await targetUser.save();

            // Log event voor goedkeuring naar de zender
            await logEvent({
                userId: request.requesterId,
                description: `Heeft een BAK verstuurd naar ${targetName} met reden: ${request.reasonBak} en is goedgekeurd.`,
            });
            // Log event voor goedkeuring naar de ontvanger
            await logEvent({
                userId: request.targetId,
                description: `Heeft een BAK ontvangen van ${requesterName} met reden: ${request.reasonBak} en is goedgekeurd.`,
            });

        } else if (status === 'declined') {
            // Als het verzoek is afgewezen, verhoog de BAK-telling van de aanvrager
            const senderUser = await User.findByPk(request.requesterId);
            senderUser.bak++;
            await senderUser.save();

            // Log event voor afwijzing naar de zender
            await logEvent({
                userId: request.requesterId,
                description: `Heeft een BAK verstuurd naar ${targetName} met reden: ${request.reasonBak} en is afgewezen.`,
            });

            // Log event voor afwijzing naar de ontvanger
            await logEvent({
                userId: request.targetId,
                description: `Heeft een BAK ontvangen van ${requesterName} met reden: ${request.reasonBak} en is afgewezen.`,
            });
        }


        res.send('BAK request updated');
    } catch (error) {
        console.error('Error updating  BAK request:', error);
        next(error);
    }
});


module.exports = router;