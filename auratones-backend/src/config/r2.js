// src/config/r2.js
const { S3Client, HeadBucketCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const crypto = require('crypto');

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v.trim();
}

const R2_ENDPOINT = reqEnv('R2_AUTH_ENDPOINT');  // endpoint copy từ Cloudflare
const R2_KEY_ID   = reqEnv('R2_AUTH_KEY_ID');    // Access Key ID
const R2_SECRET   = reqEnv('R2_AUTH_SECRET');    // Secret Access Key
const R2_BUCKET   = reqEnv('R2_BUCKET_NAME');    // tên bucket

const R2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_KEY_ID,
    secretAccessKey: R2_SECRET,
  },
  forcePathStyle: true,
});

async function checkR2() {
  await R2Client.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
  return { ok: true, bucket: R2_BUCKET };
}

function generateKey(prefix, filename = '') {
  const rand = crypto.randomBytes(6).toString('hex');
  return `${prefix}/${Date.now()}-${rand}-${filename}`;
}

async function uploadFile(key, body, contentType) {
  const upload = new Upload({
    client: R2Client,
    params: { Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
  // Trả về URL public theo endpoint đang dùng
  return `${R2_ENDPOINT.replace(/\/$/, '')}/${R2_BUCKET}/${key}`;
}

async function deleteFile(key) {
  return await R2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

module.exports = { R2Client, R2_BUCKET, checkR2, generateKey, uploadFile, deleteFile };
