const express = require('express');

const { User, Trophys, BakRequest, BakHasTakenRequest } = require('../models');

const router = express.Router();


router.get('/trophies', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'bak', 'xp', 'profilePicture']
        });

        // Render the dashboard view with the fetched data
        res.render('trophies/index', {
            user: req.user, users
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
