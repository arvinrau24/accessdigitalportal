require('dotenv').config();
const pool = require('../src/db');
const config = require('../src/config');
const { hashPassword } = require('../src/utils/fileHelpers');

async function seed() {
  const username = config.admin.username;
  const password = config.admin.password;
  const passwordHash = await hashPassword(password);

  const [existing] = await pool.query('SELECT id FROM admins WHERE username = ?', [username]);
  if (existing.length > 0) {
    console.log(`Admin "${username}" already exists. Skipping seed.`);
    return;
  }

  await pool.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [
    username,
    passwordHash,
  ]);
  console.log(`Admin seeded: username="${username}"`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
