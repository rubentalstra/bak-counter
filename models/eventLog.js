const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('EventLog', {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the user who performed the action (if applicable)'
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'A description of the event/action'
        },
        // You can add more fields here as needed, such as eventType for categorizing events
    }, {
        tableName: 'EventLogs',
        timestamps: true, // Automatically add createdAt and updatedAt timestamps
        comment: 'Table for tracking user actions and system events for administrative oversight'
    });
};
