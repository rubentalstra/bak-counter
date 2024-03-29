
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
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();





const multerUpload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: config.digitalOcean.bucket,
        acl: "public-read",
        key: function (req, file, cb) {
            const randomHex = crypto.randomBytes(8).toString("hex");
            const filename = `realtime/prove/${randomHex}${path.extname(file.originalname)}`;
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






router.get('/', rateLimiter, async (req, res) => {
    try {
        const allRequests = await BakHasTakenRequest.findAll({
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] },
                { model: User, as: 'FirstApprover', attributes: ['id', 'name'] },
                { model: User, as: 'SecondApprover', attributes: ['id', 'name'] },
                { model: User, as: 'DeclinedBy', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']],
        });

        // Separating the requests into open and closed based on their status
        const openRequests = allRequests.filter(req => req.status === 'pending');
        const closedRequests = allRequests.filter(req => ['declined', 'approved'].includes(req.status));

        res.render('bak-getrokken/index', {
            csrfToken: req.csrfToken(),
            user: req.user,
            openRequests,
            closedRequests
        });
    } catch (error) {
        console.error('Error fetching BAK validation requests:', error);
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
            await request.update({ firstApproverId: userId });

            // Log event for the first approval action
            await logEvent({
                userId: userId,
                description: `Heeft de BAK-verzoek als eerste goedkeurder goedgekeurd. Verzoek ID: ${requestId}.`
            });
        } else if (!request.secondApproverId && request.firstApproverId !== userId) {
            if (userIsAdmin || firstApproverIsAdmin) {
                await request.update({ secondApproverId: userId, status: 'approved' });

                // Increment XP for the target user
                await User.increment({ xp: 1 }, { where: { id: request.targetId } });

                // Check and decrement bak count if necessary
                const targetUser = await User.findByPk(request.targetId);
                if (targetUser.bak > 0) {
                    await targetUser.decrement('bak');
                }

                // Log event for the second approval action
                await logEvent({
                    userId: userId,
                    description: `Heeft de BAK-verzoek als tweede goedkeurder goedgekeurd. Verzoek ID: ${requestId}.`
                });

                // Notify requester and target about the approval
                await logEvent({
                    userId: request.requesterId,
                    description: `Het BAK-verzoek is goedgekeurd. Verzoek ID: ${requestId}.`
                });

                await logEvent({
                    userId: request.targetId,
                    description: `Een BAK-verzoek gericht aan jou is goedgekeurd. Verzoek ID: ${requestId}.`
                });

                // Handle evidence file deletion and other logic as before
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
        if (!req.user.isAdmin) {
            return res.status(403).send('Only admins can decline requests.');
        }

        const request = await BakHasTakenRequest.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Requester', attributes: ['id', 'name'] },
                { model: User, as: 'Target', attributes: ['id', 'name'] }
            ]
        });

        if (!request) {
            return res.status(404).send('Request not found.');
        }

        if (request.evidenceUrl) {
            await deleteImage(request.evidenceUrl);
        }

        await request.update({
            status: 'declined',
            evidenceUrl: '',
            declinedId: req.user.id
        });

        await User.increment({ bak: 1 }, { where: { id: request.Requester.id } });

        // Logging the event with the requester information already retrieved
        await logEvent({
            userId: request.Requester.id,
            description: `${req.user.name} heeft het BAK-verzoek van ${request.Requester.name} afgewezen.`,
        });

        await logEvent({
            userId: request.Target.id,
            description: `Heeft vals BAK-verzoek van ${request.Requester.name} afgewezen, door ${req.user.name}.`,
        });

        res.redirect('/bak-getrokken');
    } catch (error) {
        console.error('Error declining BAK validation request:', error);
        res.status(500).send('An unexpected error occurred.');
    }
});






// Route to show the page for creating a new BAK validation request
router.get('/create', rateLimiter, async (req, res) => {
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
            return res.status(400).json({ success: false, message: 'Aanvrager en Ontvanger kunnen niet dezelfde gebruiker zijn.' });
        }

        if (!req.file) {
            // Handle the case where the file is not uploaded
            return res.status(400).json({ success: false, message: 'Bewijs is vereist' });
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
