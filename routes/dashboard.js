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
const { adminEmails } = require('../config/isAdmin');
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




// Configure multer for file storage
const storageProve = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/prove/'); // Save files to public/uploads/prove directory
    },
    filename: function (req, file, cb) {
        let randomHex = crypto.randomBytes(8).toString('hex');
        let extension = path.extname(file.originalname);
        cb(null, randomHex + extension); // Generate unique filename
    }
});

// Only allow image or video files
const fileFilter = function (req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image or video files are allowed!'), false);
    }
};

// Initialize multer with the storage configuration
const uploadProve = multer({
    storage: storageProve,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
    }
});


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

        const profile = await User.findByPk(userId, {
            include: [{ model: EventLog, as: 'eventLogs', }],
            order: [[{ model: EventLog, as: 'eventLogs' }, 'createdAt', 'DESC']]
        });

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
            // where: {
            //     id: {
            //         [Op.not]: req.user.id // Exclude current user's ID
            //     }
            // }
        });

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
        // if (requesterId === parseInt(targetId)) { // Assuming IDs are integers
        //     const errorMessage = 'You cannot send a BAK request to yourself.';
        //     return res.redirect(`/submit-bak?errorMessage=${encodeURIComponent(errorMessage)}`);
        // }

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


router.get('/validationRequests', isAuthenticated, async (req, res) => {

    req.user.isAdmin = adminEmails.includes(req.user.email);

    try {
        const openRequests = await BakHasTakenRequest.findAll({
            where: { status: 'pending' },
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] },
                { model: User, as: 'FirstApprover', attributes: ['id', 'name'] },
                { model: User, as: 'SecondApprover', attributes: ['id', 'name'] }
            ]
        });

        const declinedRequests = await BakHasTakenRequest.findAll({
            where: { status: 'declined' },
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] },
                { model: User, as: 'DeclinedBy', attributes: ['id', 'name'] },
            ]
        });

        res.render('validationRequests', { user: req.user, openRequests, declinedRequests });
    } catch (error) {
        console.error('Error fetching open BAK validation requests:', error);
        res.status(500).send('Error fetching data');
    }
});





router.get('/validateBak/approve/:id', isAuthenticated, async (req, res) => {
    const requestId = req.params.id;
    const userId = req.user.id;
    const userIsAdmin = adminEmails.includes(req.user.email);

    try {
        const request = await BakHasTakenRequest.findByPk(requestId, {
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name', 'email'] },
                { model: User, as: 'Target', attributes: ['id', 'name', 'email'] }
            ]
        });

        // Temporarily augment users with isAdmin property
        const augmentUserWithAdminFlag = (user) => ({
            ...user.toJSON(),
            isAdmin: adminEmails.includes(user.email)
        });

        const firstApprover = request.firstApproverId ? await User.findByPk(request.firstApproverId) : null;
        const firstApproverIsAdmin = firstApprover ? augmentUserWithAdminFlag(firstApprover).isAdmin : false;

        if (!request.firstApproverId) {
            // This is the first approval
            await request.update({ firstApproverId: userId });
        } else if (!request.secondApproverId && request.firstApproverId !== userId) {
            // This is the second approval, and it's not the same user
            if (userIsAdmin || firstApproverIsAdmin) {
                // Ensure at least one admin has approved
                await request.update({ secondApproverId: userId, status: 'approved' });



                if (request.evidenceUrl) {
                    // Delete the file from the filesystem
                    await unlinkAsync(`public/uploads/prove/${request.evidenceUrl}`);
                }

                await request.update({ evidenceUrl: null }, { where: { id: requestId } });

            } else {
                // Cannot approve because there needs to be at least one admin approver
                return res.status(403).send('An admin must approve this request.');
            }
        }

        // Redirect or respond based on your application's needs
        res.redirect('/validationRequests');
    } catch (error) {
        console.error('Error approving BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});


router.get('/validateBak/decline/:id', isAuthenticated, async (req, res) => {
    req.user.isAdmin = adminEmails.includes(req.user.email);

    try {
        const requestId = req.params.id;

        // Ensure only admins can decline requests
        if (!req.user.isAdmin) {
            return res.status(403).send('Only admins can decline requests.');
        }

        // Find the request by its ID
        const request = await BakHasTakenRequest.findByPk(requestId);

        // Ensure the request exists
        if (!request) {
            return res.status(404).send('Request not found.');
        }

        // Delete the file from the filesystem
        if (request.evidenceUrl) {
            await unlinkAsync(`public/uploads/prove/${request.evidenceUrl}`);
        }

        // Update the status of the request to 'declined'
        await request.update({ status: 'declined', evidenceUrl: '', declinedId: req.user.id });

        // Add a BAK to the requester of the request
        await User.increment({ bak: 1 }, { where: { id: request.requesterId } });


        // Log the declined request
        const senderUser = await User.findByPk(request.requesterId);
        await logEvent({
            userId: senderUser.id,
            description: `${req.user.name} Declined BAK request from ${senderUser.name}`,
        });

        // Redirect or respond based on your application's needs
        res.redirect('/validationRequests');
    } catch (error) {
        console.error('Error declining BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});





// Route to show the page for creating a new BAK validation request
router.get('/validationRequests/create', isAuthenticated, async (req, res) => {
    try {
        // Fetch all users from the database to populate the select dropdown
        const users = await User.findAll({
            attributes: ['id', 'name']
        });

        // Render the create request page with the users data
        res.render('createBakValidationRequest', { user: req.user, users });
    } catch (error) {
        console.error('Error fetching users for BAK validation request:', error);
        res.status(500).send('Error fetching data');
    }
});

// Route to create a new BAK validation request
router.post('/validationRequests/create', isAuthenticated, uploadProve.single('evidence'), async (req, res) => {
    try {
        // Extract data from the request body
        const { requesterId, targetUserId } = req.body;

        // Get the file path of the uploaded evidence
        const evidenceFilePath = req.file.path.replace('public/uploads/prove/', '');

        // Create the BAK validation request
        await BakHasTakenRequest.create({
            requesterId,
            targetId: targetUserId,
            evidenceUrl: evidenceFilePath // Store the file path as evidence URL
        });

        // Redirect to a success page or back to the homepage
        res.redirect('/validationRequests');
    } catch (error) {
        console.error('Error creating BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});






// More routes for handling BAK requests and proposals here...

module.exports = router;
