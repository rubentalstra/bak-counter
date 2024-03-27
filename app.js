const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
require('./config/passport-setup');
const { sequelize } = require('./models');
const cron = require('node-cron');
const app = express();
const cookieParser = require("cookie-parser");
const csrf = require('lusca').csrf;

// Disable X-Powered-By header
app.disable('x-powered-by');


const attachPendingRequestCount = require('./middleware/pendingRequests');
const attachPendingBetsCount = require('./middleware/pendingBets');
const setAdminStatus = require('./middleware/setAdminStatus');
const { isAdmin } = require('./utils/isAdmin');
const { isAuthenticated } = require('./utils/isAuthenticated');


cron.schedule('*/30 * * * *', async () => {
    try {
        // Replace with a lightweight query suitable for your database
        await sequelize.query('SELECT 1');
        console.log('Keep-alive query executed.');
    } catch (error) {
        console.error('Error executing keep-alive query:', error);
    }
});


app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

if (process.env.LOCAL_DB == 'true') {
    app.use(session({
        name: 'mijnBakCookie',
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
    }));
} else {
    app.use(session({
        name: 'mijnBakCookie',
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            domain: 'bak-counter-app-grn3x.ondigitalocean.app',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`App listening on port ${port}`));
