const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config');

const SALT_ROUNDS = 10;
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';

function generatePassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return password;
}

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

function isAllowedUpload(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (config.upload.allowedExtensions.includes(ext)) return true;
  return config.upload.allowedMimeTypes.includes(file.mimetype);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getClientUploadDir(clientLoginId) {
  return path.join(config.paths.uploads, 'clients', clientLoginId);
}

function getClientSubDir(clientLoginId, subfolder) {
  const dir = path.join(getClientUploadDir(clientLoginId), subfolder);
  ensureDir(dir);
  return dir;
}

module.exports = {
  generatePassword,
  hashPassword,
  comparePassword,
  sanitizeFilename,
  ensureDir,
  getClientUploadDir,
  getClientSubDir,
  isAllowedUpload,
};
