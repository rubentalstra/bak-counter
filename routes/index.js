const express = require('express');
const RateLimit = require('express-rate-limit');
const router = express.Router();

const limiter = RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 250, // max 100 requests per windowMs
});

// Home page route
router.get('/', limiter, (req, res) => {
    res.render('index', { user: req.user });
});

// Login page route (assuming you have a separate login page or strategy)
router.get('/login', limiter, (req, res) => {
    res.render('login');
});

module.exports = router;
