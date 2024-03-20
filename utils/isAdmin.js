const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).send('Access denied');
};

module.exports = { isAdmin };