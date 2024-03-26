const { DataTypes } = require('sequelize');


module.exports = (sequelize) => {
    return sequelize.define('Trophy', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        trophyImage: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'URL or path to the badge image for the trophy. This field is optional and can be left blank if a trophy does not have a badge.'
        }
    }, {
        tableName: 'Trophies',
        timestamps: true,
    });
};