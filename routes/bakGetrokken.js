
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
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
        cb(null, 'uploads/temp/'); // Temporary directory for initial uploads
    },
    filename: function (req, file, cb) {
        let randomHex = crypto.randomBytes(8).toString('hex');
        let extension = path.extname(file.originalname).toLowerCase();
        cb(null, randomHex + extension); // Generate unique filename
    }
});



// Only allow image or video files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Alleen afbeeldingen of video\'s zijn toegestaan!'), false);
    }
};

// Initialize multer with the storage configuration
const uploadProve = multer({
    storage: storageProve,
    fileFilter: fileFilter,
    limits: {
        fileSize: 30 * 1024 * 1024 // Limit file size to 30MB
    }
});

const processFile = async (req, res, next) => {
    if (!req.file) return next(); // Skip if no file is uploaded

    try {
        const tempPath = req.file.path;
        // Determine output directory based on file type

        const outputPath = `public/uploads/prove/${req.file.filename}`;

        // Process only if it's an image
        if (req.file.mimetype.startsWith('image/')) {
            // Use sharp to validate and rewrite the image, stripping non-image data
            await sharp(tempPath).toFile(outputPath);
        } else if (req.file.mimetype.startsWith('video/')) {
            // Directly move video files without processing
            await fs.promises.rename(tempPath, outputPath);
        }

        // Cleanup: Delete the temporary file if it's an image (videos are moved, not copied)
        if (req.file.mimetype.startsWith('image/')) {
            await unlinkAsync(tempPath);
        }

        // Update req.file.path to the new location for further use
        req.file.path = outputPath;

        next();
    } catch (error) {
        console.error('Error processing file:', error);

        // Attempt to delete the temporary file in case of error
        try {
            await unlinkAsync(req.file.path);
        } catch (cleanupError) {
            console.error('Error cleaning up file:', cleanupError);
        }

        // Redirect with error message, customizing the message based on the file type
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        const errorMessage = `Failed to process ${fileType}. Please try again with a valid file.`;
        return res.redirect(`/bak-getrokken/create?errorMessage=${encodeURIComponent(errorMessage)}`);
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

        res.render('bak-getrokken/index', { user: req.user, openRequests, closedRequests });
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
router.get('/create', async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;
        // Fetch all users from the database to populate the select dropdown
        const users = await User.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.not]: req.user.id } }
        });

        // Render the create request page with the users data
        res.render('bak-getrokken/create', { user: req.user, users, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error('Error fetching users for BAK validation request:', error);
        res.status(500).send('Error fetching data');
    }
});


// Middleware for handling multer upload and potential errors, including file type restriction
const uploadProveMiddleware = (req, res, next) => {
    const upload = uploadProve.single('evidence');
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading (e.g., file too large).
            const errorMessage = `Er is een fout opgetreden bij het uploaden van het bewijs: ${err.message}`;
            return res.redirect(`/bak-getrokken/create?errorMessage=${encodeURIComponent(errorMessage)}`);
        } else if (err) {
            // An error occurred due to the file filter (e.g., wrong file type).
            return res.redirect(`/bak-getrokken/create?errorMessage=${encodeURIComponent(err)}`);
        }
        // If the file type and size are correct, proceed to the next middleware
        next();
    });
};



// Route to create a new BAK validation request with middleware for handling file upload
router.post('/create', uploadProveMiddleware, processFile, async (req, res) => {
    try {
        // Extract data from the request body
        const { targetUserId } = req.body;
        const requesterId = req.user.id;

        // Ensure that the requester and target are different users
        if (parseInt(requesterId) === parseInt(targetUserId)) {
            const errorMessage = 'Aanvrager en Ontvanger kunnen niet dezelfde gebruiker zijn';
            return res.redirect(`/bak-getrokken/create?errorMessage=${encodeURIComponent(errorMessage)}`);
        }

        if (!req.file) {
            // Handle the case where the file is not uploaded
            const errorMessage = 'Bewijs is vereist';
            return res.redirect(`/bak-getrokken/create?errorMessage=${encodeURIComponent(errorMessage)}`);
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
