const express = require('express');
const { Op } = require('sequelize');
const { User, Trophy, UserTrophies } = require('../models');
const ApplicationError = require('../utils/ApplicationError');
const { logEvent } = require('../utils/eventLogger');
const rateLimiter = require('../middleware/rateLimiter');
const validAlertTypes = require('../config/alertType');
const sanitizeHtml = require('sanitize-html');

const router = express.Router();


// Admin dashboard route
router.get('/', rateLimiter, async (req, res, next) => {
    try {
        const rawErrorMessage = req.query.errorMessage;
        const errorMessage = sanitizeHtml(rawErrorMessage, {
            allowedTags: [], // Geen HTML toegestaan; alleen tekst
            allowedAttributes: {}, // Geen attributen toegestaan
        });

        let alertType = req.query.alertType || 'danger';

        // Controleer of de opgegeven alertType is toegestaan, zo niet, gebruik dan de standaardwaarde 'danger'
        if (!validAlertTypes.includes(alertType)) {
            alertType = 'danger';
        }

        const leden = await User.findAll();
        res.render('admin/index', { csrfToken: req.csrfToken(), user: req.user, leden, errorMessage: errorMessage ?? null, alertType: alertType });
    } catch (error) {
        console.error("Fout bij het ophalen van gebruikers:", error);
        next(new ApplicationError("Interne Server Fout", 500));
    }
});

// Route to render the "Bewerk of Toeken Award" page
router.get('/:userId', rateLimiter, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const lid = await User.findByPk(userId);

        if (!lid) {
            throw new ApplicationError('Gebruiker niet gevonden', 404);
        }

        res.render('admin/edit', { user: req.user, lid });
    } catch (error) {
        console.error('Fout bij het ophalen van gebruiker voor bewerken of toekennen award:', error);
        next(error);
    }
});

// Route to display the BAK update form for a specific user
router.get('/:userId/edit-bak', rateLimiter, async (req, res, next) => {
    const rawErrorMessage = req.query.errorMessage;
    const errorMessage = sanitizeHtml(rawErrorMessage, {
        allowedTags: [], // Geen HTML toegestaan; alleen tekst
        allowedAttributes: {}, // Geen attributen toegestaan
    });

    const { userId } = req.params;

    if (parseInt(req.user.id) === parseInt(userId)) {
        const errorMessage = 'Je kunt je eigen BAK-telling niet wijzigen.';
        return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}`);
    }

    try {
        const lid = await User.findByPk(userId);
        if (!lid) {
            throw new ApplicationError('Gebruiker niet gevonden', 404);
        }
        res.render('admin/edit/edit_bak', { csrfToken: req.csrfToken(), user: req.user, lid, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error("Fout bij het ophalen van de gebruiker:", error);
        next(error);
    }
});

// Route to update BAK and log the event
router.post('/:userId/edit-bak', async (req, res, next) => {
    const { userId } = req.params;
    const { bakAmount, reason } = req.body;

    if (parseInt(req.user.id) === parseInt(userId)) {
        const errorMessage = 'Je kunt je eigen BAK-telling niet wijzigen.';
        return res.redirect(`/admin/${userId}/edit-bak?errorMessage=${encodeURIComponent(errorMessage)}`);
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new ApplicationError('Gebruiker niet gevonden', 404);
        }

        const oldBakAmount = user.bak;
        user.bak = bakAmount;
        await user.save();

        // Logboeking voor de admin
        await logEvent({
            userId: req.user.id,
            description: `Heeft de BAK-telling van ${user.name} met ${bakAmount - oldBakAmount} aangepast. Reden: ${reason}`
        });

        // Logboeking voor de betrokken gebruiker
        await logEvent({
            userId: user.id,
            description: `De BAK-telling is met ${bakAmount - oldBakAmount} aangepast door admin ${req.user.name}. Reden: ${reason}`
        });

        res.redirect('/admin');
    } catch (error) {
        console.error("Fout bij het bijwerken van BAK-telling:", error);
        next(error);
    }
});


// Route to render the page for assigning an award
router.get('/:userId/assign-award', rateLimiter, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const rawErrorMessage = req.query.errorMessage;
        const errorMessage = sanitizeHtml(rawErrorMessage, {
            allowedTags: [], // Geen HTML toegestaan; alleen tekst
            allowedAttributes: {}, // Geen attributen toegestaan
        });
        let alertType = req.query.alertType || 'danger';

        // Controleer of de opgegeven alertType is toegestaan, zo niet, gebruik dan de standaardwaarde 'danger'
        if (!validAlertTypes.includes(alertType)) {
            alertType = 'danger';
        }

        const lid = await User.findByPk(userId);

        if (!lid) {
            errorMessage = "Gebruiker niet gevonden";
            return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }

        // Exclude trophy names that are already associated with the user or are in the excluded list
        const excludedTrophyNames = ['Junior', 'Senior', 'Master', 'Alcoholist', 'Leverfalen', 'Strooier', 'Mormel', 'Schoft', 'Klootzak'];

        // First, fetch the IDs of trophies already awarded to the user
        const userTrophies = await UserTrophies.findAll({
            where: { userId: userId },
            attributes: ['trophyId'],
            raw: true,
        });

        const awardedTrophyIds = userTrophies.map(ut => ut.trophyId);

        // Then, query for trophies that have not been awarded to the user and are not in the excluded list
        const defaultTrophies = await Trophy.findAll({
            where: {
                id: { [Op.notIn]: awardedTrophyIds }, // Exclude trophies by their IDs
                name: { [Op.notIn]: excludedTrophyNames }, // Exclude trophies by name
            },
            include: [{
                model: User,
                as: 'Winners',
                attributes: [],
                through: {
                    attributes: [],
                },
            }],
        });

        res.render('admin/edit/assign_award', { csrfToken: req.csrfToken(), user: req.user, lid, defaultTrophies, errorMessage: errorMessage ?? null, alertType: alertType });
    } catch (error) {
        console.error("Fout bij het ophalen van gebruiker voor toekennen award:", error);
        next(new ApplicationError("Fout bij het ophalen van gebruiker voor toekennen award", 500));
    }
});

// Route to handle the submission of the award assignment
router.post('/:userId/assign-award', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { award, reason } = req.body;

        // Find the user by ID
        const user = await User.findByPk(userId);
        if (!user) {
            errorMessage = "Gebruiker niet gevonden";
            return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }

        // Find the trophy by ID
        const trophy = await Trophy.findByPk(award);
        if (!trophy) {
            errorMessage = 'Award niet gevonden.';
            return res.redirect(`/admin/${userId}/assign-award?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }

        // Check if the user already has the trophy
        const existingUserTrophy = await UserTrophies.findOne({
            where: {
                userId: userId,
                trophyId: award
            }
        });

        if (existingUserTrophy) {
            errorMessage = 'De gebruiker heeft deze award al.';
            return res.redirect(`/admin/${userId}/assign-award?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }

        // Assign the trophy to the user
        await UserTrophies.create({
            userId: userId,
            trophyId: award
        });


        // Logboeking voor de admin
        await logEvent({
            userId: req.user.id,
            description: `Heeft award ${trophy.name} toegekend aan ${user.name}. Reden: ${reason}`
        });

        // Logboeking voor de betrokken gebruiker
        await logEvent({
            userId: user.id,
            description: `Award ${trophy.name} ontvangen van admin ${req.user.name}. Reden: ${reason}`
        });

        // Redirect back to the assign award page with success message
        const errorMessage = 'De award is succesvol toegekend.';
        return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}&alertType=success`);
    } catch (error) {
        console.error("Fout bij het toekennen van award aan gebruiker:", error);
        next(new ApplicationError("Fout bij het toekennen van award aan gebruiker", 500));
    }
});


// Route to render the page for removing an award
router.get('/:userId/remove-award', rateLimiter, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const rawErrorMessage = req.query.errorMessage;
        const errorMessage = sanitizeHtml(rawErrorMessage, {
            allowedTags: [], // Geen HTML toegestaan; alleen tekst
            allowedAttributes: {}, // Geen attributen toegestaan
        });
        let alertType = req.query.alertType || 'danger';

        // Controleer of de opgegeven alertType is toegestaan, zo niet, gebruik dan de standaardwaarde 'danger'
        if (!validAlertTypes.includes(alertType)) {
            alertType = 'danger';
        }

        // Find the user by ID
        const user = await User.findByPk(userId);
        if (!user) {
            errorMessage = "Gebruiker niet gevonden";
            return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }


        // Fetch the awards associated with the user
        const userTrophies = await UserTrophies.findAll({
            where: { userId: userId },
            include: [{ model: Trophy, as: 'Trophy' }] // Use the alias as defined in your association
        });


        res.render('admin/edit/remove_award', { csrfToken: req.csrfToken(), user: req.user, lid: user, userTrophies, errorMessage: errorMessage ?? null, alertType: alertType });
    } catch (error) {
        console.error("Fout bij het ophalen van gebruiker voor verwijderen award:", error);
        next(new ApplicationError("Fout bij het ophalen van gebruiker voor verwijderen award", 500));
    }
});



// Route to handle the removal of an award
router.post('/:userId/remove-award', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { awardId, reason } = req.body;

        // Find the user by ID
        const user = await User.findByPk(userId);
        if (!user) {
            errorMessage = "Gebruiker niet gevonden";
            return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }

        // Check if the user has the specified award
        const userTrophy = await UserTrophies.findOne({
            where: {
                userId: userId,
                trophyId: awardId
            },
            include: [{
                model: Trophy,
                as: 'Trophy',
                attributes: ['name']
            }]
        });

        if (!userTrophy) {
            errorMessage = "De gebruiker heeft dit award niet.";
            return res.redirect(`/admin/${userId}/remove-award?errorMessage=${encodeURIComponent(errorMessage)}&alertType=danger`);
        }

        // Remove the trophy from the user
        await userTrophy.destroy();

        // Logboeking voor de admin
        await logEvent({
            userId: req.user.id,
            description: `Heeft award ${userTrophy.Trophy.name} verwijderd van ${user.name}. Reden: ${reason}`
        });

        // Logboeking voor de betrokken gebruiker
        await logEvent({
            userId: user.id,
            description: `Award ${userTrophy.Trophy.name} verwijderd door admin ${req.user.name}. Reden: ${reason}`
        });

        // Redirect back to the assign award page with success message
        const errorMessage = 'De award is succesvol verwijderd.';
        return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}&alertType=success`);
    } catch (error) {
        console.error("Fout bij het verwijderen van award van gebruiker:", error);
        next(new ApplicationError("Fout bij het verwijderen van award van gebruiker", 500));
    }
});


module.exports = router;
