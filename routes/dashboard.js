const express = require('express');
const multer = require('multer');
const { sequelize, BakRequest, User, BakHasTakenRequest } = require('../models');
const { Op } = require('sequelize');
const { logEvent } = require('../utils/eventLogger');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });


// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Fetch all users with their confirmed BAK counts
        const users = await User.findAll({
            attributes: ['id',
                'name',
                'bak',
                [sequelize.literal(`(SELECT COUNT(*) FROM BakRequest WHERE BakRequest.targetId = User.id AND BakRequest.status = 'pending')`), 'pendingBakRequestCount'],
                [sequelize.literal(`(SELECT COUNT(*) FROM BakHasTakenRequest WHERE BakHasTakenRequest.targetId = User.id AND BakHasTakenRequest.status = 'pending')`), 'pendingBakHasTakenRequestCount']
            ]
        });

        // Render the dashboard view with the fetched data
        res.render('dashboard', { user: req.user, users });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



router.get('/submit-bak', isAuthenticated, async (req, res) => {
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

        console.log(users)

        res.render('submit-bak', { user: req.user, users, errorMessage: errorMessage ?? null });
    } catch (error) {
        res.status(500).send(error.message);
    }
});



// Route to handle form submission
router.post('/submit-bak', isAuthenticated, async (req, res) => {
    try {
        const { targetId, reasonBak } = req.body;
        const requesterId = req.user.id; // Assuming you have user ID stored in session

        // Check if requesterId and targetId are the same
        if (requesterId === parseInt(targetId)) { // Assuming IDs are integers
            const errorMessage = 'You cannot send a BAK request to yourself.';
            return res.redirect(`/submit-bak?errorMessage=${encodeURIComponent(errorMessage)}`);
        }

        // Continue with BAK request creation
        await BakRequest.create({
            requesterId,
            targetId,
            reasonBak,
            status: 'pending'
        });

        res.redirect('/dashboard'); // Redirect to the dashboard or another appropriate page
    } catch (error) {
        res.status(500).send(error.message);
    }
});



router.get('/validate-bak', isAuthenticated, async (req, res) => {
    try {
        const bakRequests = await BakRequest.findAll({
            where: { targetId: req.user.id, status: 'pending' },
            include: [{ model: User, as: 'Requester', attributes: ['name'] }]
        });
        res.render('validate-bak', { user: req.user, bakRequests });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching BAK requests');
    }
});

router.post('/bak-request/:requestId/:status', async (req, res) => {
    const { requestId, status } = req.params;
    try {
        const request = await BakRequest.findByPk(requestId);
        if (!request) {
            return res.status(404).send('Request not found');
        }

        // Check if the user is authorized to update the request
        if (request.targetId !== req.user.id) {
            return res.status(403).send('Not authorized');
        }

        // Update request status
        request.status = status;
        await request.save();

        // Update BAK counts based on request status
        if (status === 'approved') {
            // If request is approved, increment BAK count of the target
            const targetUser = await User.findByPk(request.targetId);
            targetUser.bak++;
            await targetUser.save();
            // Log event for BAK request approval
            await logEvent({
                userId: req.user.id,
                description: `Approved BAK request for ${targetUser.name}`,
                ipAddress: req.ip
            });
        } else if (status === 'declined') {
            // If request is declined, increment BAK count of the sender
            const senderUser = await User.findByPk(request.requesterId);
            senderUser.bak++;
            await senderUser.save();
            // Log event for BAK request decline
            await logEvent({
                userId: req.user.id,
                description: `Declined BAK request from ${senderUser.name}`,
                ipAddress: req.ip
            });
        }

        res.send('BAK request updated');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating BAK request');
    }
});



// More routes for handling BAK requests and proposals here...

module.exports = router;
