const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('BakHasTakenRequest', {
        requesterId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The user who is submitting the request on behalf of another user'
        },
        targetId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The user for whom the BAK is being requested'
        },
        evidenceUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'URL to the evidence supporting the claim that a BAK has been taken'
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'declined'),
            defaultValue: 'pending',
            comment: 'The current status of the BAK request'
        },
        // New fields to track approvers
        firstApproverId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the first user who approved the request'
        },
        secondApproverId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the second user who approved the request'
        },
        declinedId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id',
            },
            comment: 'The ID of the user who declined the request'
        }
    }, {
        tableName: 'BakHasTakenRequest',
        timestamps: true, // Automatically add createdAt and updatedAt timestamps
        comment: 'Table for managing requests for BAK validations'
    });
};
