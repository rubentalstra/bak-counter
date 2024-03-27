const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    digitalOcean: {
        endpoint: 'ams3.digitaloceanspaces.com', // Use your Space endpoint
        accessKeyId: process.env.accessKeyId,
        secretAccessKey: process.env.secretAccessKey,
        bucket: 'bak-counter-images'
    },
    uploadLimits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
};

