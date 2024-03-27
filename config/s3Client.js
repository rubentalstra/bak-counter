const { S3Client } = require("@aws-sdk/client-s3");
const config = require("./config");

const s3Client = new S3Client({
    region: 'eu-central-1',
    // region: "us-east-1", // Specify the region your DigitalOcean Spaces is in, e.g., "nyc3" is not valid, use "us-east-1"
    endpoint: `https://${config.digitalOcean.endpoint}`, // e.g., 'https://nyc3.digitaloceanspaces.com'
    credentials: {
        accessKeyId: config.digitalOcean.accessKeyId,
        secretAccessKey: config.digitalOcean.secretAccessKey,
    },
    forcePathStyle: true, // Required for DigitalOcean Spaces
});


module.exports = { s3Client };
