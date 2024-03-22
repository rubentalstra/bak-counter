const dotenv = require('dotenv');
dotenv.config();

const { Sequelize, Op } = require('sequelize');

// Initialize the database connection
// const sequelize = new Sequelize('sqlite:./db.sqlite');

// Initialize the database connection for Azure SQL Server using environment variables
const sequelize = new Sequelize(process.env.AZURE_SQL_DATABASE, process.env.AZURE_SQL_USER, process.env.AZURE_SQL_PASSWORD, {
    host: process.env.AZURE_SQL_SERVER,
    dialect: 'mssql', // Specify using MSSQL
    dialectModule: require('tedious'), // Explicitly require the 'tedious' module
    dialectOptions: {
        options: {
            encrypt: true, // Necessary for Azure SQL Database
            trustServerCertificate: true, // Set to true only if on a local/trusted server
            keepAlive: true, // Enable TCP keep-alive
            keepAliveInitialDelay: 30000, // Start sending keep-alive packets after 30 seconds of inactivity
        }
    },
    pool: {
        max: 5, // Maximum number of connections in pool
        min: 0, // Minimum number of connections in pool
        acquire: 30000, // Maximum time, in milliseconds, that pool will try to get connection before throwing error
        idle: 10000 // Maximum time, in milliseconds, that a connection can be idle before being released
    },
    logging: false, // Disable logging
});

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
