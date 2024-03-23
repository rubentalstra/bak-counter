require('dotenv').config();

const adminEmails = process.env.ADMIN_EMAILS.split(',');

module.exports = { adminEmails };