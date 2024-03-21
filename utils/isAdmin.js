
// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) return next();
    res.status(403).send('Access denied');
}


module.exports = { isAdmin };