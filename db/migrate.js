const mysql = require('mysql2/promise');
require('dotenv').config();

async function columnExists(conn, database, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [database, table, column]
  );
  return rows[0].c > 0;
}

async function tableExists(conn, database, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [database, table]
  );
  return rows[0].c > 0;
}

async function migrate(conn, database) {
  await conn.query(`USE \`${database}\``);

  await conn.query(`
    ALTER TABLE clients
    MODIFY COLUMN status ENUM('pending_onboarding','draft','submitted','approved','rejected')
    DEFAULT 'pending_onboarding'
  `);

  if (!(await columnExists(conn, database, 'clients', 'auth_version'))) {
    await conn.query('ALTER TABLE clients ADD COLUMN auth_version INT NOT NULL DEFAULT 0 AFTER password_hash');
  }

  if (await tableExists(conn, database, 'templates')) {
    if (!(await columnExists(conn, database, 'templates', 'original_filename'))) {
      await conn.query('ALTER TABLE templates ADD COLUMN original_filename VARCHAR(255) NULL');
    }
    if (await columnExists(conn, database, 'templates', 'template_key')) {
      await conn.query('ALTER TABLE templates MODIFY COLUMN template_key VARCHAR(255) NULL');
    }
    if (await columnExists(conn, database, 'templates', 'display_name')) {
      await conn.query('ALTER TABLE templates MODIFY COLUMN display_name VARCHAR(255) NULL');
    }
    if (await columnExists(conn, database, 'templates', 'original_filename')) {
      const hasDisplay = await columnExists(conn, database, 'templates', 'display_name');
      const hasKey = await columnExists(conn, database, 'templates', 'template_key');
      if (hasDisplay && hasKey) {
        await conn.query(`
          UPDATE templates
          SET original_filename = COALESCE(NULLIF(original_filename, ''), display_name, template_key, 'template')
          WHERE original_filename IS NULL OR original_filename = ''
        `);
      } else if (hasDisplay) {
        await conn.query(`
          UPDATE templates
          SET original_filename = COALESCE(NULLIF(original_filename, ''), display_name, 'template')
          WHERE original_filename IS NULL OR original_filename = ''
        `);
      }
    }
  }

  await conn.query(`
    ALTER TABLE uploaded_documents
    MODIFY COLUMN doc_type VARCHAR(80) NOT NULL
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS template_uploads (
      id INT PRIMARY KEY AUTO_INCREMENT,
      client_id INT NOT NULL,
      template_id INT NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      original_filename VARCHAR(255),
      is_draft BOOLEAN DEFAULT TRUE,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
      UNIQUE KEY unique_client_template (client_id, template_id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS support_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_type ENUM('password_reset','general_support') NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      account_identifier VARCHAR(150) NOT NULL,
      message TEXT NULL,
      client_id INT NULL,
      status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
      admin_notes TEXT NULL,
      resolved_by INT NULL,
      resolved_at DATETIME NULL,
      password_reset_by INT NULL,
      password_reset_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES admins(id) ON DELETE SET NULL,
      FOREIGN KEY (password_reset_by) REFERENCES admins(id) ON DELETE SET NULL,
      INDEX idx_support_requests_status_created (status, created_at),
      INDEX idx_support_requests_client_id (client_id)
    )
  `);

  console.log('Database migrations applied.');
}

async function runStandalone() {
  const database = process.env.MYSQL_DATABASE || 'client_portal';
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true,
  });
  try {
    await migrate(conn, database);
  } finally {
    await conn.end();
  }
}

module.exports = { migrate };

if (require.main === module) {
  runStandalone().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}
