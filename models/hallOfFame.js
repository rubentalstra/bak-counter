const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('HallOfFame', {
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: 'The order of the event in the hall of fame'
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
        },
        gebeurtenis: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        activiteit: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        tableName: 'HallOfFame',
        timestamps: true,
    });
};