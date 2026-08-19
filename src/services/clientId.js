const pool = require('../db');

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'client';
}

async function generateClientLoginId(companyName) {
  const base = slugify(companyName);
  const [exact] = await pool.query(
    'SELECT id FROM clients WHERE client_login_id = ? LIMIT 1',
    [base]
  );
  if (exact.length === 0) {
    return base;
  }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}_${n}`;
    const [rows] = await pool.query(
      'SELECT id FROM clients WHERE client_login_id = ? LIMIT 1',
      [candidate]
    );
    if (rows.length === 0) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique client login ID');
}

module.exports = { slugify, generateClientLoginId };
