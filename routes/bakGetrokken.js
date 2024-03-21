
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

const { User, BakHasTakenRequest } = require('../models');
const { Op } = require('sequelize');
const { logEvent } = require('../utils/eventLogger');
const { isAuthenticated } = require('../utils/isAuthenticated');
const { adminEmails } = require('../config/isAdmin');
const router = express.Router();



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

router.get('/', isAuthenticated, async (req, res) => {
    try {
        const openRequests = await BakHasTakenRequest.findAll({
            where: { status: 'pending' },
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] },
                { model: User, as: 'FirstApprover', attributes: ['id', 'name'] },
                { model: User, as: 'SecondApprover', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']],
        });

        const closedRequests = await BakHasTakenRequest.findAll({
            where: { status: ['declined', 'approved'] },
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] },
                { model: User, as: 'FirstApprover', attributes: ['id', 'name'] },
                { model: User, as: 'SecondApprover', attributes: ['id', 'name'] },
                { model: User, as: 'DeclinedBy', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']],
        });

        res.render('bak-getrokken/index', { user: req.user, openRequests, closedRequests });
    } catch (error) {
        console.error('Error fetching open BAK validation requests:', error);
        res.status(500).send('Error fetching data');
    }
});





router.get('/validate/approve/:id', isAuthenticated, async (req, res) => {
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

                await request.update({ evidenceUrl: '' }, { where: { id: requestId } });

            } else {
                // Cannot approve because there needs to be at least one admin approver
                return res.status(403).send('An admin must approve this request.');
            }
        }

        // Redirect or respond based on your application's needs
        res.redirect('/bak-getrokken');
    } catch (error) {
        console.error('Error approving BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});


router.get('/validate/decline/:id', isAuthenticated, async (req, res) => {
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
            description: `${req.user.name} heeft het BAK-verzoek van ${senderUser.name} afgewezen.`,
        });

        // Redirect or respond based on your application's needs
        res.redirect('/bak-getrokken');
    } catch (error) {
        console.error('Error declining BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});





// Route to show the page for creating a new BAK validation request
router.get('/create', isAuthenticated, async (req, res) => {
    try {
        // Fetch all users from the database to populate the select dropdown
        const users = await User.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.not]: req.user.id } }
        });

        // Render the create request page with the users data
        res.render('bak-getrokken/create', { user: req.user, users });
    } catch (error) {
        console.error('Error fetching users for BAK validation request:', error);
        res.status(500).send('Error fetching data');
    }
});

// Route to create a new BAK validation request
router.post('/create', isAuthenticated, uploadProve.single('evidence'), async (req, res) => {
    try {
        // Extract data from the request body
        const { targetUserId } = req.body;
        const requesterId = req.user.id;

        // Ensure that the requester and target are different users
        if (requesterId === targetUserId) {
            return res.status(400).send('Aanvrager en Ontvanger kunnen niet dezelfde gebruiker zijn');
        }


        // Get the file path of the uploaded evidence
        const evidenceFilePath = req.file.path.replace('public/uploads/prove/', '');

        // Create the BAK validation request
        await BakHasTakenRequest.create({
            requesterId,
            targetId: targetUserId,
            evidenceUrl: evidenceFilePath // Store the file path as evidence URL
        });

        // Redirect to a success page or back to the homepage
        res.redirect('/bak-getrokken');
    } catch (error) {
        console.error('Error creating BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});




module.exports = router;
