const { DataTypes } = require('sequelize');

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
        profileGIF: {
            type: DataTypes.STRING,
            allowNull: true
        },
        profileDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    });
};
