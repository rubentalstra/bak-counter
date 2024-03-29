const express = require('express');
const RateLimit = require('express-rate-limit');
const passport = require('passport');

const router = express.Router();


const limiter = RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 250, // max 100 requests per windowMs
});


// Route to initiate Google OAuth
router.get('/auth/google', limiter, passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback route after Google OAuth
router.get('/auth/google/callback', limiter,
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
