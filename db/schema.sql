CREATE DATABASE IF NOT EXISTS client_portal;
USE client_portal;

CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_login_id VARCHAR(150) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  client_type ENUM('A','B') NOT NULL,
  commercial_mode ENUM('Outright Purchase','Lease to Own','Rent') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  auth_version INT NOT NULL DEFAULT 0,
  status ENUM('pending_onboarding','draft','submitted','approved','rejected') DEFAULT 'pending_onboarding',
  rejection_reason TEXT NULL,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_type ENUM('A','B') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by INT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS onboarding_forms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  form_data JSON NOT NULL,
  signature_path VARCHAR(500),
  stamp_path VARCHAR(500),
  generated_pdf_path VARCHAR(500),
  is_draft BOOLEAN DEFAULT TRUE,
  submitted_at DATETIME NULL,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  doc_type VARCHAR(80) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  is_draft BOOLEAN DEFAULT TRUE,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE KEY unique_client_doc (client_id, doc_type)
);

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
);

CREATE TABLE IF NOT EXISTS review_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  admin_id INT NOT NULL,
  action ENUM('approved','rejected') NOT NULL,
  reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

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
);
