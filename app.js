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

app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});



const attachPendingRequestCount = require('./middleware/pendingRequests');
const attachPendingBetsCount = require('./middleware/pendingBets');
const setAdminStatus = require('./middleware/setAdminStatus');
const { isAdmin } = require('./utils/isAdmin');
const { isAuthenticated } = require('./utils/isAuthenticated');
const ApplicationError = require('./utils/ApplicationError');




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
            domain: 'bak.sv-realtime.nl',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        }
    }));
}

app.use(csrf());

app.set('trust proxy', 1); // Trust first proxy
app.use(passport.initialize());
app.use(passport.session());



app.use(setAdminStatus);


app.set('view engine', 'ejs');
app.use(express.static('public'));


app.use(require('./routes/auth'));
app.use(require('./routes/index'));

app.use(attachPendingRequestCount);
app.use(attachPendingBetsCount);

app.use(isAuthenticated, require('./routes/dashboard'));
app.use('/bets', isAuthenticated, require('./routes/bets'));
app.use('/profile', isAuthenticated, require('./routes/profile'));
app.use('/bak', isAuthenticated, require('./routes/bak'));
app.use('/hall-of-fame', isAuthenticated, require('./routes/hallOfFame'));
app.use('/bak-getrokken', isAuthenticated, require('./routes/bakGetrokken'));
app.use('/admin', isAuthenticated, isAdmin, require('./routes/admin'));

app.use((req, res, next) => {
    const err = new ApplicationError('Page Not Found', 404);
    next(err);
});

// Global error handler
app.use((error, req, res, next) => {
    const status = error instanceof ApplicationError ? error.status : 500;
    const message = error instanceof ApplicationError ? error.message : 'Internal Server Error';
    console.error(error);
    return res.status(status).render('error/error', { errorCode: status, errorMessage: message });
});


myStore.sync();

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`App listening on port ${port}`));
