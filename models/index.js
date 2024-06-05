const { sequelize } = require('../database/connection');

// Import model definitions and initialize them with the sequelize instance
const User = require('./user')(sequelize);
const BakRequest = require('./bakRequest')(sequelize); // Ensure the model file name matches
const BakHasTakenRequest = require('./bakHasTakenRequest')(sequelize); // New model import
const EventLog = require('./eventLog')(sequelize); // Import the EventLog model
const Bet = require('./bet')(sequelize); // Import the new Bet model
const Trophy = require('./trophy')(sequelize); // Import the new trophy model
const UserTrophies = require('./UserTrophies')(sequelize); // Import the new trophy model
const HallOfFame = require('./hallOfFame')(sequelize); // Import the new HallOfFame model


// Setup associations for User and BakRequest
User.hasMany(BakRequest, {
    as: 'Requests',
    foreignKey: 'requesterId'
});
User.hasMany(BakRequest, {
    as: 'BakRequests',
    foreignKey: 'targetId'
});
BakRequest.belongsTo(User, {
    as: 'Requester',
    foreignKey: 'requesterId'
});
BakRequest.belongsTo(User, {
    as: 'Target',
    foreignKey: 'targetId'
});

// BakHasTakenRequest model associations
User.hasMany(BakHasTakenRequest, {
    as: 'SentProposals',
    foreignKey: 'requesterId'
});
User.hasMany(BakHasTakenRequest, {
    as: 'ReceivedProposals',
    foreignKey: 'targetId'
});
User.hasMany(BakHasTakenRequest, {
    as: 'ApproverFirst',
    foreignKey: 'firstApproverId'
});
User.hasMany(BakHasTakenRequest, {
    as: 'ApproverSecond',
    foreignKey: 'secondApproverId'
});
User.hasMany(BakHasTakenRequest, {
    as: 'DeclinedProposals',
    foreignKey: 'declinedId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'Requester',
    foreignKey: 'requesterId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'Target',
    foreignKey: 'targetId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'FirstApprover',
    foreignKey: 'firstApproverId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'SecondApprover',
    foreignKey: 'secondApproverId'
});
BakHasTakenRequest.belongsTo(User, {
    as: 'DeclinedBy',
    foreignKey: 'declinedId'
});


// Setup associations for User and EventLog
User.hasMany(EventLog, {
    foreignKey: 'userId',
    as: 'eventLogs'
});
EventLog.belongsTo(User, {
    foreignKey: 'userId',
    as: 'User'
});

// Setup associations for User and HallOfFame
User.hasMany(HallOfFame, {
    foreignKey: 'userId',
    as: 'hallOfFame'
});
HallOfFame.belongsTo(User, {
    foreignKey: 'userId',
    as: 'User'
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


// Setup associations
User.belongsToMany(Trophy, { through: UserTrophies, as: 'Trophies', foreignKey: 'userId' });
Trophy.belongsToMany(User, { through: UserTrophies, as: 'Winners', foreignKey: 'trophyId' });
Trophy.hasMany(UserTrophies, { foreignKey: 'trophyId', as: 'UserTrophies' });
UserTrophies.belongsTo(Trophy, { foreignKey: 'trophyId', as: 'Trophy' });

// Synchronize the models with the database
sequelize.sync({ force: false }).then(() => {
    console.log('Database & tables created!');
}).catch((error) => {
    console.error('Error synchronizing the database:', error);
});

module.exports = {
    sequelize,
    User,
    BakRequest,
    BakHasTakenRequest,
    EventLog,
    Bet,
    Trophy,
    UserTrophies,
    HallOfFame
};
