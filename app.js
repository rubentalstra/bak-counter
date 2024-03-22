const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
require('./config/passport-setup');
const app = express();

const attachPendingRequestCount = require('./middleware/pendingRequests');
const attachPendingBetsCount = require('./middleware/pendingBets');
const setAdminStatus = require('./middleware/setAdminStatus');
const { isAdmin } = require('./utils/isAdmin');
const { isAuthenticated } = require('./utils/isAuthenticated');

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Parse application/json
app.use(bodyParser.json());


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

app.set('trust proxy', true);


app.use(passport.initialize());
app.use(passport.session());

// Apply it globally
app.use(attachPendingRequestCount);
app.use(attachPendingBetsCount);
app.use(setAdminStatus);

// Set up routes
app.use(require('./routes/auth'));
app.use(require('./routes/index'));
app.use(isAuthenticated, require('./routes/dashboard'));
app.use('/bets', isAuthenticated, require('./routes/bets'));
app.use('/profile', isAuthenticated, require('./routes/profile'));
app.use('/bak', isAuthenticated, require('./routes/bak'));
app.use('/bak-getrokken', isAuthenticated, require('./routes/bakGetrokken'));
app.use('/admin', isAuthenticated, isAdmin, require('./routes/admin'));


app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(function (req, res, next) {
    res.status(404).render('error/404');
});


const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`App listening on port ${port}`));

