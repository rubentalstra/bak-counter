const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const { Sequelize, Op } = require('sequelize');

function isLocal() {
    if (process.env.LOCAL_DB == 'true') {
        // Initialize the database connection
        console.log('Using local db')
        const sequelize = new Sequelize('sqlite:./db.sqlite');
        return sequelize
    } else {
        // Initialize the database connection for MYSQL using environment variables
        console.log('Using MYSQL db')

        const sslOptions = {
            ssl: {
                require: true,
                rejectUnauthorized: true,
                ca: fs.readFileSync('certs/ca-certificate.crt')
            }
        };

        const sequelize = new Sequelize(process.env.AZURE_SQL_DATABASE, process.env.AZURE_SQL_USER, process.env.AZURE_SQL_PASSWORD, {
            port: process.env.AZURE_SQL_PORT,
            host: process.env.AZURE_SQL_SERVER,
            dialect: 'mysql', // Specify using mysql
            dialectOptions: {
                ssl: sslOptions.ssl,
            },
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            },
            logging: false, //  console.log
        });
        return sequelize
    }
}

const sequelize = isLocal()

module.exports = { sequelize };