const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');
dotenv.config();

const { User } = require('../models');
const ApplicationError = require('../utils/ApplicationError');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    scope: ['profile', 'email']
},
    async (accessToken, refreshToken, profile, cb) => {
        try {
            const email = profile.emails[0].value;
            // Ensure the email domain is @sv-realtime.nl
            if (!email.endsWith('@sv-realtime.nl')) {
                throw new ApplicationError("Invalid email domain", 403);
            }

            const emailSurnamePart = email.substring(email.indexOf('.') + 1, email.lastIndexOf('@')).toLowerCase();
            const displayNameSurname = profile.displayName.toLowerCase().replace(/\s+/g, '');

            if (!displayNameSurname.includes(emailSurnamePart)) {
                throw new ApplicationError("Graag inloggen met je persoonlijke account.", 403);
            }

            let user = await findOrCreateUser({
                googleId: profile.id,
                email: email,
                name: profile.displayName,
            });

            return cb(null, user);
        } catch (error) {
            return cb(error, null);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // Implement your logic to find a user by their ID and pass the user object to done
    findUserById(id, (err, user) => {
        done(err, user);
    });
});

async function findOrCreateUser(userInfo) {
    let user = await User.findOrCreate({ where: { googleId: userInfo.googleId }, defaults: userInfo });
    return user[0]; // Sequelize findOrCreate returns an array [instance, created]
}

// Helper function to find a user by ID
function findUserById(id, callback) {
    // Implement this function based on your User model and database
    User.findByPk(id).then(user => callback(null, user)).catch(err => callback(err, null));
}


