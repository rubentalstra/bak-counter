// middleware/setAdminStatus.js
const { adminEmails } = require("../config/isAdmin");

function setAdminStatus(req, res, next) {
    if (req.user && req.user.email) {
        req.user.isAdmin = adminEmails.includes(req.user.email);
    } else {
        req.user = { isAdmin: false }; // If no user is logged in, create a dummy user object with isAdmin set to false
    }
    next();
}

module.exports = setAdminStatus;
