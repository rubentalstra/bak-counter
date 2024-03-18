const express = require('express');
const { BakRequest, User } = require('../models');
const router = express.Router();

// Middleware to check if the user is an admin
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).send('Access denied');
};

// Admin dashboard route
router.get('/admin/dashboard', isAdmin, async (req, res) => {
    try {
        const requests = await BakRequest.findAll();
        res.render('admin/dashboard', { user: req.user, requests });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

router.get('/admin/dashboard/event-logs', async (req, res) => {
    try {
        const eventLogs = await EventLog.findAll({
            include: [{ model: User, attributes: ['name'] }], // If you want to include user information
            order: [['createdAt', 'DESC']]
        });
        res.render('admin/admin-event-logs', { eventLogs });
    } catch (error) {
        res.status(500).send(error.message);
    }
});


// More admin routes (e.g., approve/deny requests) here...

module.exports = router;
