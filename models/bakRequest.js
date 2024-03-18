const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('BakRequest', {
        requesterId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The user who sends the BAK request'
        },
        targetId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The recipient of the BAK request'
        },
        reasonBak: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Reason why this person needs to take a BAK'
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'declined'),
            defaultValue: 'pending',
            comment: 'The current status of the BAK request'
        }
    }, {
        tableName: 'BakRequest',
        timestamps: true, // Optionally add timestamps if you want to track when proposals are created/updated
        comment: 'Table for managing BAK request between users'
    });
};
