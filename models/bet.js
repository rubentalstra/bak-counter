const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Bet', {
        betId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
            comment: 'Unique identifier for each bet'
        },
        initiatorUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the user who initiated the bet'
        },
        opponentUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the user who accepted the bet'
        },
        judgeUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the user designated as the judge to decide the outcome'
        },
        betTitle: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'A title name for a Bet'
        },
        betDescription: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'A detailed description of what the bet entails'
        },
        stake: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'The number of REP points (or "bakken") at stake for the bet'
        },
        winnerUserId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the user who won the bet (set by the judge)'
        },
        opponentApproval: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Indicates whether the opponent has approved the bet'
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
            defaultValue: 'pending',
            allowNull: false,
            comment: 'The current status of the bet'
        }
    }, {
        tableName: 'Bets',
        timestamps: true, // Automatically add createdAt and updatedAt timestamps
        comment: 'Table for managing bets between users, including the judge, stakes, and outcome'
    });
};
