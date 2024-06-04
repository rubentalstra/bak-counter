const express = require('express');

const { HallOfFame, User } = require('../models');
const { Op } = require('sequelize');
const { logEvent } = require('../utils/eventLogger');
const ApplicationError = require('../utils/ApplicationError');
const rateLimiter = require('../middleware/rateLimiter');
const sanitizeHtml = require('sanitize-html');

const router = express.Router();



// Admin dashboard route
router.get('/', rateLimiter, async (req, res, next) => {
    try {
        const hallOfFame = await HallOfFame.findAll({
            include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
            order: [['order', 'ASC']],

        });

        res.render('hall-of-fame/index', { csrfToken: req.csrfToken(), user: req.user, hallOfFame });
    } catch (error) {
        console.error("Fout bij het ophalen van gebruikers:", error);
        next(new ApplicationError("Interne Server Fout", 500));
    }
});

// Route to render the form to create a new entry
router.get('/new', async (req, res) => {
    // Fetch all users from the database to populate the select dropdown
    const users = await User.findAll({
        attributes: ['id', 'name']
    });

    res.render('hall-of-fame/create', { csrfToken: req.csrfToken(), user: req.user, users });
});

// Route to handle the form submission to create a new entry
router.post('/', async (req, res) => {
    try {
        const { order, userId, gebeurtenis, activiteit } = req.body;
        await HallOfFame.create({ order, userId, gebeurtenis, activiteit });
        res.redirect('/hall-of-fame');
    } catch (error) {
        console.error("Fout bij het maken van een nieuwe entry:", error);
        res.status(500).send("Er is een fout opgetreden bij het maken van de nieuwe entry.");
    }
});

module.exports = router;