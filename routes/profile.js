const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

const { User, EventLog } = require('../models');
const { Op } = require('sequelize');
const { isAuthorized } = require('../utils/isAuthorized');
const { getUserLevelDetails, getUserReputationDetails } = require('../utils/levelUtils');
const router = express.Router();




// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/temp/'); // Temporary directory for initial uploads
    },
    filename: function (req, file, cb) {
        let randomHex = crypto.randomBytes(8).toString('hex');
        cb(null, randomHex + path.extname(file.originalname)); // Construct file name with original extension
    }
});

// Add a file filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const isSupportedFile = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);

    if (isSupportedFile) {
        cb(null, true);
    } else {
        cb('Only image files (JPEG, JPG, PNG, GIF) are allowed!');
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // for example, limit file size to 10MB
});

const processImage = async (req, res, next) => {
    if (!req.file) return next(); // Skip if no file is uploaded

    const tempPath = req.file.path;
    const outputPath = `public/uploads/profile/${req.file.filename}`;
    const isGif = req.file.mimetype === 'image/gif';

    try {
        if (!isGif) {
            // Use sharp to process non-GIF images, stripping non-image data
            await sharp(tempPath).toFile(outputPath);
        } else {
            // For GIFs, just move them without processing
            fs.copyFileSync(tempPath, outputPath);
        }

        // Cleanup: Delete the temporary file
        await unlinkAsync(tempPath);

        // Update req.file.path to the new location for further use
        req.file.path = outputPath;

        next();
    } catch (error) {
        console.error('Error processing image:', error);

        // Attempt to delete the temporary file in case of error
        try {
            await unlinkAsync(tempPath);
        } catch (cleanupError) {
            console.error('Error cleaning up image file:', cleanupError);
        }

        // Redirect with error message
        const errorMessage = 'Failed to process image. Please try again with a valid image file.';
        return res.redirect(`/profile/${req.user.id}?errorMessage=${encodeURIComponent(errorMessage)}`);
    }
};




router.get('/:userId', async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;
        const userId = req.params.userId;

        const profile = await User.findByPk(userId, {
            include: [{ model: EventLog, as: 'eventLogs', }],
            order: [[{ model: EventLog, as: 'eventLogs' }, 'createdAt', 'DESC']]
        });

        const levelDetails = getUserLevelDetails(profile.xp);
        const reputationDetails = getUserReputationDetails(profile.rep);

        res.render('profile/index', {
            user: req.user,
            profile,
            errorMessage: errorMessage ?? null,
            level: levelDetails.level,
            reputation: reputationDetails.reputation,
            xpPercentage: levelDetails.xpPercentage,
            repPercentage: reputationDetails.repPercentage,
            nextXPLevel: levelDetails.nextXPLevel,
            nextRepTier: reputationDetails.nextRepTier
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).send('Error fetching user profile');
    }
});



// Middleware for handling multer upload and potential errors, including file type restriction
const uploadMiddleware = (req, res, next) => {
    const uploadWithMulter = upload.single('profilePicture');
    uploadWithMulter(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading (e.g., file too large).
            const errorMessage = `Er is een fout opgetreden bij het uploaden van het bestand: ${err.message}`;
            return res.redirect(`/profile/${req.user.id}?errorMessage=${encodeURIComponent(errorMessage)}`);
        } else if (err) {
            // A custom error from the fileFilter (e.g., wrong file type).
            return res.redirect(`/profile/${req.user.id}?errorMessage=${encodeURIComponent(err)}`);
        }
        // Everything went fine, proceed to the next middleware
        next();
    });
};





router.post('/updatePicture', isAuthorized, uploadMiddleware, processImage, async (req, res) => {
    if (!req.file) {
        const errorMessage = 'Geen bestand geüpload. Zorg ervoor dat het bestandstype wordt ondersteund.';
        return res.redirect(`/profile/${req.user.id}?errorMessage=${encodeURIComponent(errorMessage)}`);
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
        const errorMessage = 'Fout bij het bijwerken van de profielfoto.';
        res.redirect(`/profile/${req.user.id}?errorMessage=${encodeURIComponent(errorMessage)}`);
    }
});


router.post('/deletePicture', isAuthorized, async (req, res) => {
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
router.post('/updateDescription', isAuthorized, async (req, res) => {
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


module.exports = router;
