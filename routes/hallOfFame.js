const express = require('express');

const { HallOfFame, User } = require('../models');
const ApplicationError = require('../utils/ApplicationError');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();


// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
    if (req.user && req.user.isAdmin === true) {
        return next();
    }
    res.redirect('/?errorMessage=Unauthorized&alertType=danger');
}


// Admin dashboard route
router.get('/', rateLimiter, async (req, res, next) => {
    try {
        const hallOfFame = await HallOfFame.findAll({
            include: [{ model: User, as: 'User', attributes: ['id', 'name'] }],
            order: [
                ['order', 'ASC'],
            ],
        });

        const rawErrorMessage = req.query.errorMessage;
        let alertType = req.query.alertType || 'danger';

        res.render('hall-of-fame/index', { csrfToken: req.csrfToken(), user: req.user, hallOfFame, errorMessage: rawErrorMessage, alertType });
    } catch (error) {
        console.error("Fout bij het ophalen van gebruikers:", error);
        next(new ApplicationError("Interne Server Fout", 500));
    }
});

// Route to render the form to create a new entry
router.get('/new', isAdmin, async (req, res) => {
    // Fetch all users from the database to populate the select dropdown
    const users = await User.findAll({
        attributes: ['id', 'name']
    });

    res.render('hall-of-fame/new', { csrfToken: req.csrfToken(), user: req.user, users });
});

// Route to handle the form submission to create a new entry
router.post('/new', isAdmin, async (req, res) => {
    try {
        const { userId, prestatie, activiteit } = req.body;

        // Fetch the highest current order value
        const lastEntry = await HallOfFame.findOne({
            order: [['order', 'DESC']]
        });

        const newOrder = lastEntry ? lastEntry.order + 1 : 1;

        await HallOfFame.create({ order: newOrder, userId, prestatie, activiteit });
        res.redirect('/hall-of-fame');
    } catch (error) {
        console.error("Fout bij het maken van een nieuwe entry:", error);
        res.status(500).send("Er is een fout opgetreden bij het maken van de nieuwe entry.");
    }
});

// Route to handle reordering
router.post('/reorder', isAdmin, async (req, res) => {
    try {
        const { items } = req.body;
        const updatePromises = items.map(item =>
            HallOfFame.update({ order: item.order }, { where: { id: item.id } })
        );
        await Promise.all(updatePromises);
        res.status(200).json({ message: 'Order updated' });
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: 'Failed to update order' });
    }
});


module.exports = router;