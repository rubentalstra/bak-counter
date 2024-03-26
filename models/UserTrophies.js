const { DataTypes } = require('sequelize');
const { Trophy, User } = require('.');

module.exports = (sequelize) => {
    return sequelize.define('UserTrophies', {
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: User,
                key: 'id'
            }
        },
        trophyId: {
            type: DataTypes.INTEGER,
            references: {
                model: Trophy,
                key: 'id'
            }
        },
        earnedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: 'The date and time when the trophy was earned.'
        }
    }, {
        tableName: 'UserTrophies',
        timestamps: false
    });
};