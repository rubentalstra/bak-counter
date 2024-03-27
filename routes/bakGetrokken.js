
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");

const { User, BakHasTakenRequest } = require('../models');
const { Op } = require('sequelize');
const { logEvent } = require('../utils/eventLogger');
const { adminEmails } = require('../config/isAdmin');
const { s3Client } = require('../config/s3Client');
const config = require('../config/config');

const router = express.Router();



const multerUpload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: config.digitalOcean.bucket,
        acl: "public-read",
        key: function (req, file, cb) {
            const randomHex = crypto.randomBytes(8).toString("hex");
            const filename = `prove/${randomHex}${path.extname(file.originalname)}`;
            cb(null, filename);
        },
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Alleen afbeeldingen of video\'s zijn toegestaan!'), false);
        }
    },
    limits: { fileSize: 30 * 1024 * 1024 }, // Limit file size to 30MB
});



const deleteImage = async (filePath) => {
    const params = {
        Bucket: config.digitalOcean.bucket,
        Key: filePath,
    };
    try {
        await s3Client.send(new DeleteObjectCommand(params));
        console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
    }
};






router.get('/', async (req, res) => {
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

        res.render('bak-getrokken/index', { csrfToken: req.csrfToken(), user: req.user, openRequests, closedRequests });
    } catch (error) {
        console.error('Error fetching open BAK validation requests:', error);
        res.status(500).send('Error fetching data');
    }
});




router.get('/validate/approve/:id', async (req, res) => {
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

        if (!request) {
            return res.status(404).send('Request not found');
        }

        if (userId === request.requesterId || userId === request.targetId) {
            // Prevent requester or target from approving
            return res.status(403).send('Requester or target cannot approve the request.');
        }

        const augmentUserWithAdminFlag = (user) => ({
            ...user.toJSON(),
            isAdmin: adminEmails.includes(user.email)
        });

        let firstApprover = null;
        let firstApproverIsAdmin = false;
        if (request.firstApproverId) {
            firstApprover = await User.findByPk(request.firstApproverId);
            firstApproverIsAdmin = augmentUserWithAdminFlag(firstApprover).isAdmin;
        }

        if (!request.firstApproverId) {
            // This is the first approval
            await request.update({ firstApproverId: userId });
        } else if (!request.secondApproverId && request.firstApproverId !== userId) {
            // This is the second approval, and it's not the same user
            if (userIsAdmin || firstApproverIsAdmin) {
                // At least one admin must approve, proceed with second approval
                await request.update({ secondApproverId: userId, status: 'approved' });

                // Additional logic for handling evidence file deletion
                if (request.evidenceUrl) {
                    try {
                        await deleteImage(request.evidenceUrl);
                        await request.update({ evidenceUrl: '' });
                    } catch (fileError) {
                        console.error('Error deleting evidence file:', fileError);
                    }
                }
            } else {
                return res.status(403).send('An admin must approve this request.');
            }
        } else {
            // Request already fully approved or user attempting to approve again
            return res.status(403).send('Request already approved or cannot be approved by this user.');
        }

        res.redirect('/bak-getrokken');
    } catch (error) {
        console.error('Error approving BAK validation request:', error);
        res.status(500).send('Error processing request');
    }
});



router.get('/validate/decline/:id', async (req, res) => {
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
        if (request.request) {
            await deleteImage(request.evidenceUrl);
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
router.get('/create', async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;
        // Fetch all users from the database to populate the select dropdown
        const users = await User.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.not]: req.user.id } }
        });

        // Render the create request page with the users data
        res.render('bak-getrokken/create', { csrfToken: req.csrfToken(), user: req.user, users, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error('Error fetching users for BAK validation request:', error);
        res.status(500).send('Error fetching data');
    }
});





// Route to create a new BAK validation request with middleware for handling file upload
router.post('/create', multerUpload.single('evidence'), async (req, res) => {
    try {
        // Extract data from the request body
        const { targetUserId } = req.body;
        const requesterId = req.user.id;

        // Ensure that the requester and target are different users
        if (parseInt(requesterId) === parseInt(targetUserId)) {
            res.status(500).json({ success: false, message: 'Aanvrager en Ontvanger kunnen niet dezelfde gebruiker zijn' });
        }

        if (!req.file) {
            // Handle the case where the file is not uploaded
            res.status(500).json({ success: false, message: 'Bewijs is vereist' });
        }

        // Get the file path of the uploaded evidence
        const evidenceFilePath = req.file.key; // Use the key from the uploaded file

        // Create the BAK validation request
        await BakHasTakenRequest.create({
            requesterId,
            targetId: targetUserId,
            evidenceUrl: evidenceFilePath // Store the file path as evidence URL
        });

        // Redirect to a success page or back to the homepage

        res.json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error creating BAK validation request:', error);
        res.status(500).json({ success: false, message: 'Fout bij het maken van een Getrokken BAK request.' });
    }
});





module.exports = router;
