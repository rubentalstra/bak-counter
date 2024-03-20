const { User } = require("../models");

// Middleware to check if the user is authorized to edit the profile
async function isAuthorized(req, res, next) {
    const userId = req.user.id; // Adjust based on how user ID is stored in your session
    const user = await User.findByPk(userId);

    if (!user) {
        return res.status(404).send('User not found.');
    }

    // Ensure the user making the request is the profile owner
    if (userId === user.id) {
        return next();
    }

    res.status(403).send('You are not authorized to edit this profile.');
}

module.exports = { isAuthorized };