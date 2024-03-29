const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const { DeleteObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

const { User, EventLog, Trophy } = require('../models');
const { isAuthorized } = require('../utils/isAuthorized');
const { getUserLevelDetails, getUserReputationDetails } = require('../utils/levelUtils');
const config = require('../config/config');
const { s3Client } = require('../config/s3Client');
const router = express.Router();
const sharp = require('sharp');
const rateLimiter = require('../middleware/rateLimiter');





const multerUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const isSupportedFile =
            allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
            allowedTypes.test(file.mimetype);
        if (isSupportedFile) {
            cb(null, true);
        } else {
            cb(new Error("Only image files (JPEG, JPG, PNG, GIF) are allowed!"), false); //! alart is not showing in the profile page
        }
    },
    limits: { fileSize: config.uploadLimits.fileSize },
});


const uploadImageToSpaces = async (req, res, next) => {
    if (!req.file) return next(); // Skip if no file is uploaded

    const randomHex = crypto.randomBytes(8).toString("hex");
    const filename = `realtime/profile/${randomHex}${path.extname(req.file.originalname)}`;
    const mimeType = req.file.mimetype;

    try {
        let imageBuffer = req.file.buffer;

        if (mimeType !== 'image/gif') {
            // Resize if not a GIF
            imageBuffer = await sharp(req.file.buffer).toBuffer();
        }

        // Upload to DigitalOcean Spaces
        const uploadParams = {
            Bucket: config.digitalOcean.bucket,
            Key: filename,
            Body: imageBuffer,
            ContentType: mimeType,
            ACL: "public-read",
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Save the filename to request for further processing in next middleware or route handler
        req.file.filename = filename; // Store the path for further use
        next();
    } catch (error) {
        console.error("Error processing or uploading image:", error);
        res.status(500).json({ success: false, message: "Error processing or uploading image." });
    }
};


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




router.get('/:userId', rateLimiter, async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;
        const alertType = req.query.alertType || 'danger';
        const userId = req.params.userId;

        const profile = await User.findByPk(userId, {
            include: [{ model: EventLog, as: 'eventLogs', },
            {
                model: Trophy,
                as: 'Trophies',
                through: { attributes: [] },
                attributes: ['name', 'description', 'trophyImage']
            }],
            order: [[{ model: EventLog, as: 'eventLogs' }, 'createdAt', 'DESC']]
        });

        const levelDetails = getUserLevelDetails(profile.xp);
        const reputationDetails = getUserReputationDetails(profile.rep);

        res.render('profile/index', {
            csrfToken: req.csrfToken(),
            user: req.user,
            profile,
            errorMessage: errorMessage ?? null,
            alertType: alertType,
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




router.post('/updatePicture', isAuthorized, multerUpload.single('profilePicture'), uploadImageToSpaces, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Geen bestand geüpload. Zorg ervoor dat het bestandstype wordt ondersteund.',
        });
    }

    const userId = req.user.id;
    const filePath = req.file.filename; // Filename in Spaces

    try {
        const user = await User.findByPk(userId);
        if (user.profilePicture) {
            // Attempt to delete the old picture, if it exists
            await deleteImage(user.profilePicture);
        }

        await User.update({ profilePicture: filePath }, { where: { id: userId } });
        res.json({ success: true, message: 'Profielfoto succesvol bijgewerkt.' });
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).json({ success: false, message: 'Fout bij het bijwerken van de profielfoto.' });
    }
});


router.post('/deletePicture', isAuthorized, async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findByPk(userId);

        if (user.profilePicture) {
            await deleteImage(user.profilePicture);
            // Now update the user record to remove or update the profilePicture field
            await User.update({ profilePicture: null }, { where: { id: userId } });
        }


        if (Number.isInteger(req.user.id)) {
            res.redirect(`/profile/${parseInt(req.user.id)}`);
        } else {
            res.redirect('/dashboard');
        }
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
