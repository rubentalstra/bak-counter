const express = require('express');

const { User, BakRequest } = require('../models');
const { Op } = require('sequelize');
const { isAuthenticated } = require('../utils/isAuthenticated');
const { logEvent } = require('../utils/eventLogger');
const router = express.Router();



router.get('/submit', async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;

        // Fetch all users except the current user
        const users = await User.findAll({
            where: {
                id: {
                    [Op.not]: req.user.id // Exclude current user's ID
                }
            }
        });

        res.render('bak-send-recieve/submit', { user: req.user, users, errorMessage: errorMessage ?? null });
    } catch (error) {
        res.status(500).send(error.message);
    }
});



router.post('/submit', async (req, res) => {
    try {
        const { targetId, reasonBak } = req.body;
        const requesterId = req.user.id;

        // Check if requesterId and targetId are the same
        if (parseInt(requesterId) === parseInt(targetId)) {
            const errorMessage = 'You cannot send a BAK request to yourself.';
            return res.redirect(`/submit-bak?errorMessage=${encodeURIComponent(errorMessage)}`);
        }

        // Retrieve both requester and target user details
        const requester = await User.findByPk(requesterId);
        const target = await User.findByPk(targetId);

        if (!requester || !target) {
            const errorMessage = 'Gebruiker niet gevonden.';
            return res.redirect(`/submit-bak?errorMessage=${encodeURIComponent(errorMessage)}`);
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
            description: `Je hebt een BAK verzoek gestuurd naar ${target.name} met reden: ${reasonBak}.`
        });

        // Log event for the target
        await logEvent({
            userId: targetId,
            description: `Je hebt een BAK verzoek ontvangen van ${requester.name} met reden: ${reasonBak}.`
        });


        res.redirect('/dashboard');
    } catch (error) {
        res.status(500).send(error.message);
    }
});



router.get('/validate', async (req, res) => {
    const requesterId = req.user.id;

    try {
        const bakRequests = await BakRequest.findAll({
            where: { targetId: requesterId, status: 'pending' },
            include: [{ model: User, as: 'Requester', attributes: ['name'] }]
        });

        console.log(bakRequests)
        res.render('bak-send-recieve/validate', { user: req.user, bakRequests });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching BAK requests');
    }
});

router.post('/validate/:requestId/:status', async (req, res) => {
    const { requestId, status } = req.params;
    try {
        const request = await BakRequest.findByPk(requestId, {
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] }
            ]
        });

        if (!request) {
            return res.status(404).send('Request not found');
        }

        const requesterName = request.Requester.name;
        const targetName = request.Target.name;

        // Check if the user is authorized to update the request
        if (request.targetId !== req.user.id) {
            return res.status(403).send('Not authorized');
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
        console.error(error);
        res.status(500).send('Error updating BAK request');
    }
});


module.exports = router;