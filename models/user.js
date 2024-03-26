const { DataTypes } = require('sequelize');
const { awardTrophyIfEligible } = require('../utils/awardTrophyIfEligible');

module.exports = (sequelize) => {
    return sequelize.define('User', {
        googleId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        bak: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        xp: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        rep: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        profilePicture: {
            type: DataTypes.STRING,
            allowNull: true
        },
        profileDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        // tableName: 'User',
        timestamps: true,
        hooks: {
            async afterUpdate(user, options) {
                console.info('User updated, checking for trophies...');
                if (user.changed('xp') || user.changed('rep')) {
                    await awardTrophyIfEligible(user.id);
                }
            }
        }
    });
};
