const express = require('express');
const router = express.Router();

// Home page route
router.get('/', (req, res) => {
    res.render('index', { user: req.user });
});

// Login page route (assuming you have a separate login page or strategy)
router.get('/login', (req, res) => {
    res.render('login');
});

module.exports = router;
