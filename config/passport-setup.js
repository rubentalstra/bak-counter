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
                name: profile.displayName,
                // You might want to add more fields here
            });

            // Optionally, check if the user is an admin and set isAdmin flag accordingly

            return cb(null, user);
        } catch (error) {
            return cb(error, null);
        }
    }
));

// Passport serialization of the user
passport.serializeUser((user, done) => {
    done(null, user.id); // Store user ID in the session
});

// Passport deserialization of the user
passport.deserializeUser((id, done) => {
    findUserById(id, (err, user) => {
        done(err, user); // Retrieve the user object from the session ID
    });
});

// Helper function to find or create a user based on Google ID
async function findOrCreateUser(userInfo) {
    let [user, created] = await User.findOrCreate({
        where: { googleId: userInfo.googleId },
        defaults: userInfo
    });
    return user; // Return the user instance
}

// Helper function to find a user by ID
const userCache = new Map();

function findUserById(id, callback) {
    if (userCache.has(id)) {
        return callback(null, userCache.get(id));
    }

    User.findByPk(id)
        .then(user => {
            userCache.set(id, user); // Cache the user object
            callback(null, user);
        })
        .catch(err => callback(err, null));
}

