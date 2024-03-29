const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const { sequelize } = require('./database/connection'); // Adjust the path as necessary
const bodyParser = require('body-parser');
const passport = require('passport');
require('./config/passport-setup');

const app = express();

// Setting up the session store
const myStore = new SequelizeStore({
    db: sequelize,
    checkExpirationInterval: 15 * 60 * 1000, // The interval in milliseconds to check for expired sessions. For example, 15 minutes.
    expiration: 24 * 60 * 60 * 1000, // The maximum age (in milliseconds) of a valid session. For example, 24 hours.
});


const cookieParser = require("cookie-parser");
const csrf = require('lusca').csrf;

// Disable X-Powered-By header
app.disable('x-powered-by');


const attachPendingRequestCount = require('./middleware/pendingRequests');
const attachPendingBetsCount = require('./middleware/pendingBets');
const setAdminStatus = require('./middleware/setAdminStatus');
const { isAdmin } = require('./utils/isAdmin');
const { isAuthenticated } = require('./utils/isAuthenticated');




app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

if (process.env.LOCAL_DB == 'true') {
    app.use(session({
        name: 'mijnBakCookie',
        secret: process.env.SESSION_SECRET,
        store: myStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        }
    }));
} else {
    app.use(session({
        name: 'mijnBakCookie',
        secret: process.env.SESSION_SECRET,
        store: myStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            domain: 'bak-counter-app-grn3x.ondigitalocean.app',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        }
    }));
}

app.use(csrf());

app.set('trust proxy', true);
app.use(passport.initialize());
app.use(passport.session());



app.use(setAdminStatus);

// Set up rate limiter: maximum of 100 requests per 15 minutes
var RateLimit = require('express-rate-limit');
var limiter = RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 250, // max 100 requests per windowMs
});


app.set('view engine', 'ejs');
app.use(express.static('public'));

// Apply rate limiter to all requests
app.use(limiter);

app.use(require('./routes/auth'));
app.use(require('./routes/index'));

app.use(attachPendingRequestCount);
app.use(attachPendingBetsCount);

app.use(isAuthenticated, require('./routes/dashboard'));
app.use('/bets', isAuthenticated, require('./routes/bets'));
app.use('/profile', isAuthenticated, require('./routes/profile'));
app.use('/bak', isAuthenticated, require('./routes/bak'));
app.use('/bak-getrokken', isAuthenticated, require('./routes/bakGetrokken'));
app.use('/admin', isAuthenticated, isAdmin, require('./routes/admin'));



app.use(function (req, res, next) {
    res.status(404).render('error/404');
});

myStore.sync();

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`App listening on port ${port}`));
