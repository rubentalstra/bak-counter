const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
require('./config/passport-setup');
const app = express();

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Parse application/json
app.use(bodyParser.json());


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

// Set up routes
app.use(require('./routes/auth'));
app.use(require('./routes/index'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/admin'));

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.listen(8080, () => console.log('App listening on port 8080'));

