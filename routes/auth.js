const express = require('express');

const passport = require('passport');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();


// Route to initiate Google OAuth
router.get('/auth/google', rateLimiter, passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback route after Google OAuth
router.get('/auth/google/callback', rateLimiter,
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});


module.exports = router;
