// middleware/setAdminStatus.js
const { adminEmails } = require("../config/isAdmin");

function setAdminStatus(req, res, next) {
    if (req.user && req.user.email) {
        req.user.isAdmin = adminEmails.includes(req.user.email);
    }

    next();
}

module.exports = setAdminStatus;
