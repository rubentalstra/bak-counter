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
            encrypt: true, // Required for Azure SQL Database
            trustServerCertificate: true, // Depending on your SSL configuration, might not be needed
            keepAlive: true, // Keep the connection alive
            keepAliveInitialDelay: 15000, // Adjust the initial delay for keepAlive to 15 seconds
            connectTimeout: 30000, // Increase the connection timeout to 30 seconds
            requestTimeout: 60000 // Increase the request timeout to 60 seconds
        }
    },
    pool: {
        max: 5, // Increase max connections in the pool to 5
        min: 1, // Minimum number of connections in the pool
        acquire: 30000, // Increase maximum time to acquire a connection to 30 seconds
        idle: 10000 // Increase idle time before releasing a connection to 10 seconds
    },
    logging: false, // Enable logging for debugging purposes (consider disabling in production)
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
