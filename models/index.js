const { Sequelize, Op } = require('sequelize');

// Initialize the database connection
const sequelize = new Sequelize('sqlite:./db.sqlite');

// Import model definitions and initialize them with the sequelize instance
const User = require('./user')(sequelize);
const BakRequest = require('./bakRequest')(sequelize); // Ensure the model file name matches
const BakHasTakenRequest = require('./bakHasTakenRequest')(sequelize); // New model import
const EventLog = require('./eventLog')(sequelize); // Import the EventLog model
const Bet = require('./bet')(sequelize); // Import the new Bet model

// Setup associations for User and BakRequest
User.hasMany(BakRequest, {
    as: 'Requests',
    foreignKey: 'requesterId'
});
BakRequest.belongsTo(User, {
    as: 'Requester',
    foreignKey: 'requesterId'
});
BakRequest.belongsTo(User, {
    as: 'Target',
    foreignKey: 'targetId'
});

// Setup associations for User and BakHasTakenRequest
User.hasMany(BakHasTakenRequest, {
    as: 'SentProposals',
    foreignKey: 'requesterId'
});
User.hasMany(BakHasTakenRequest, {
    as: 'ReceivedProposals',
    foreignKey: 'targetId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'Requester',
    foreignKey: 'requesterId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'Target',
    foreignKey: 'targetId'
});

// Setup associations for User and EventLog
User.hasMany(EventLog, {
    foreignKey: 'userId',
    as: 'eventLogs'
});

// Setup associations for User and Bet
User.hasMany(Bet, {
    as: 'InitiatedBets',
    foreignKey: 'initiatorUserId'
});
User.hasMany(Bet, {
    as: 'OpponentBets',
    foreignKey: 'opponentUserId'
});
User.hasMany(Bet, {
    as: 'JudgedBets',
    foreignKey: 'judgeUserId'
});
Bet.belongsTo(User, {
    as: 'Initiator',
    foreignKey: 'initiatorUserId'
});
Bet.belongsTo(User, {
    as: 'Opponent',
    foreignKey: 'opponentUserId'
});
Bet.belongsTo(User, {
    as: 'Judge',
    foreignKey: 'judgeUserId'
});

// Synchronize the models with the database
sequelize.sync({ force: false }).then(() => {
    console.log('Database & tables created!');
});

module.exports = {
    sequelize,
    User,
    BakRequest,
    BakHasTakenRequest,
    EventLog,
    Bet
};
