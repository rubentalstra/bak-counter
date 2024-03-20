const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

const { sequelize, BakRequest, User, BakHasTakenRequest, EventLog } = require('../models');
const { Op } = require('sequelize');
const { logEvent } = require('../utils/eventLogger');
const { isAuthenticated } = require('../utils/isAuthenticated');
const { isAuthorized } = require('../utils/isAuthorized');
const router = express.Router();



// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/profile/'); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
        let randomHex = crypto.randomBytes(8).toString('hex');
        let extension = path.extname(file.originalname);
        cb(null, randomHex + extension); // Construct file name
    }
});

const upload = multer({ storage: storage });





router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Fetch all users with their confirmed BAK counts
        const users = await User.findAll({
            attributes: ['id',
                'name',
                'bak',
                'profilePicture',
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


router.get('/profile/:userId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.params.userId;
        const profile = await User.findByPk(userId, { include: 'eventLogs' });

        const xpLevels = [0, 10, 25, 50, 100, 200]; // XP milestones
        const repTiers = [0, 10, 25, 50, 100]; // REP milestones
        const levelNames = ['Looser', 'Junior', 'Senior', 'Master', 'Alcoholist', 'Leverfalen'];
        const reputationNames = ['Neutral', 'Strooier', 'Mormel', 'Schoft', 'Klootzak'];

        let levelIndex = xpLevels.findIndex(xp => profile.xp < xp) - 1;
        if (levelIndex === -2) levelIndex = xpLevels.length - 1; // Handles max level case
        let repIndex = repTiers.findIndex(rep => profile.rep < rep) - 1;
        if (repIndex === -2) repIndex = repTiers.length - 1; // Handles max rep case

        const nextXPLevel = levelIndex + 1 < xpLevels.length ? xpLevels[levelIndex + 1] : null;
        const nextRepTier = repIndex + 1 < repTiers.length ? repTiers[repIndex + 1] : null;

        // Calculate percentage towards next level/tier for dynamic progress bar updates
        const xpPercentage = nextXPLevel ? Math.round((profile.xp / nextXPLevel) * 100) : 100;
        const repPercentage = nextRepTier ? Math.round((profile.rep / nextRepTier) * 100) : 100;

        res.render('profile/index', {
            user: req.user,
            profile,
            level: levelNames[levelIndex],
            reputation: reputationNames[repIndex],
            xpPercentage,
            repPercentage,
            nextXPLevel,
            nextRepTier
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).send('Error fetching user profile');
    }
});


router.post('/profile/updatePicture', isAuthenticated, isAuthorized, upload.single('profilePicture'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const userId = req.user.id;
    const filePath = req.file.path.replace('public/uploads/profile/', '');

    try {
        const user = await User.findByPk(userId);
        if (user.profilePicture) {
            // Attempt to delete the old picture, if it exists
            try {
                await unlinkAsync(`public/uploads/profile/${user.profilePicture}`);
            } catch (err) {
                console.log("Failed to delete old profile picture:", err.message);
            }
        }

        await User.update({ profilePicture: filePath }, { where: { id: userId } });
        res.redirect(`/profile/${req.user.id}`);
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).send('Error updating profile.');
    }
});


router.post('/profile/deletePicture', isAuthenticated, isAuthorized, async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findByPk(userId);
        if (user.profilePicture) {
            // Delete the file from the filesystem
            await unlinkAsync(`public/uploads/profile/${user.profilePicture}`);
        }

        await User.update({ profilePicture: null }, { where: { id: userId } });
        res.redirect(`/profile/${req.user.id}`);
    } catch (error) {
        console.error('Error deleting profile picture:', error);
        res.status(500).send('Error updating profile.');
    }
});


// Route for updating profile description
router.post('/profile/updateDescription', isAuthenticated, isAuthorized, async (req, res) => {
    const { profileDescription } = req.body;
    const userId = req.user.id; // Adjust based on your session management

    try {
        await User.update({ profileDescription }, { where: { id: userId } });
        res.redirect(`/profile/${req.user.id}`);
    } catch (error) {
        console.error('Error updating profile description:', error);
        res.status(500).send('Error updating profile.');
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

router.post('/bak-request/:requestId/:status', isAuthenticated, async (req, res) => {
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
            });
        }

        res.send('BAK request updated');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating BAK request');
    }
});



router.get('/eventLogs', isAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1; // Default to first page
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 logs per page
    const offset = (page - 1) * limit;

    try {
        const { count, rows } = await EventLog.findAndCountAll({
            include: [{
                model: User,
                as: 'User',
                attributes: ['id', 'name']
            }],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });
        const totalPages = Math.ceil(count / limit);

        res.render('eventLogs', {
            user: req.user,
            eventLogs: rows,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching event logs:', error);
        res.status(500).send('Error fetching event logs');
    }
});




// More routes for handling BAK requests and proposals here...

module.exports = router;
