const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');
dotenv.config();

const { User } = require('../models');

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
                throw new Error("Invalid email domain");
            }

            // Implement findOrCreateUser function based on your user model and database
            let user = await findOrCreateUser({
                googleId: profile.id,
                email: email,
                name: profile.displayName
                // You might want to add more fields here
            });

            // Optionally, check if the user is an admin and set isAdmin flag accordingly
            const adminEmails = ['admin1@sv-realtime.nl', 'admin2@sv-realtime.nl']; // Add your admin emails here
            user.isAdmin = adminEmails.includes(email);

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
