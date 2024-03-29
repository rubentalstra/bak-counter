const { S3Client } = require("@aws-sdk/client-s3");
const config = require("./config");

const s3Client = new S3Client({
    region: 'eu-central-1',
    endpoint: `https://${config.digitalOcean.endpoint}`,
    credentials: {
        accessKeyId: config.digitalOcean.accessKeyId,
        secretAccessKey: config.digitalOcean.secretAccessKey,
    },
    forcePathStyle: true, // Required for DigitalOcean Spaces
});


module.exports = { s3Client };
