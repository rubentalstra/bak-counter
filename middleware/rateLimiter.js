const RateLimit = require('express-rate-limit');

const rateLimiter = RateLimit({
    windowMs: 15 * 60 * 1000,
    max: 250,
});

module.exports = rateLimiter;