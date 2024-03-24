const express = require('express');
const { User } = require('../models');
const { logEvent } = require('../utils/eventLogger');
const router = express.Router();

// Admin dashboard route
router.get('/', async (req, res) => {
    try {
        const errorMessage = req.query.errorMessage;

        const leden = await User.findAll();
        res.render('admin/index', { csrfToken: req.csrfToken(), user: req.user, leden, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error("Fout bij het ophalen van gebruikers:", error);
        res.status(500).send("Interne Server Fout");
    }
});

// Route to display the BAK update form for a specific user
router.get('/:userId/edit', async (req, res) => {
    const errorMessage = req.query.errorMessage;

    const { userId } = req.params;

    if (parseInt(req.user.id) === parseInt(userId)) {
        const errorMessage = 'Je kunt je eigen BAK-telling niet wijzigen.';
        return res.redirect(`/admin?errorMessage=${encodeURIComponent(errorMessage)}`);
    }

    try {
        const lid = await User.findByPk(userId);
        if (!lid) {
            return res.status(404).send("lid niet gevonden");
        }
        res.render('admin/edit', { csrfToken: req.csrfToken(), user: req.user, lid, errorMessage: errorMessage ?? null });
    } catch (error) {
        console.error("Fout bij het ophalen van de gebruiker:", error);
        res.status(500).send("Interne Server Fout");
    }
});

// Route to update BAK and log the event
router.post('/:userId/edit', async (req, res) => {
    const { userId } = req.params;
    const { bakAmount, reason } = req.body;

    if (parseInt(req.user.id) === parseInt(userId)) {
        const errorMessage = 'Je kunt je eigen BAK-telling niet wijzigen.';
        return res.redirect(`/admin/${userId}/edit?errorMessage=${encodeURIComponent(errorMessage)}`);
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send("Gebruiker niet gevonden");
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
        res.status(500).send("Interne Server Fout");
    }
});


module.exports = router;
