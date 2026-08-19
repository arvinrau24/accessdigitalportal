const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { migrate } = require('./migrate');

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true,
};

async function setup() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const database = process.env.MYSQL_DATABASE || 'client_portal';
  const connection = await mysql.createConnection(config);
  try {
    await connection.query(schema);
    console.log('Database schema applied successfully.');
    await migrate(connection, database);
  } finally {
    await connection.end();
  }
}

setup().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
