const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

const { User, EventLog } = require('../models');
const { Op } = require('sequelize');
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

// Add a file filter
const fileFilter = (req, file, cb) => {
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images and GIFs Only!');
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // for example, limit file size to 10MB
});



router.get('/:userId', async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;
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
            errorMessage: errorMessage ?? null,
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





router.post('/updatePicture', isAuthorized, uploadMiddleware, async (req, res) => {
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
