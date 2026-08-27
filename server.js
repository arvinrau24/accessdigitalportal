require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./src/config');
const { ensureDir } = require('./src/utils/fileHelpers');

app.set('trust proxy', 1);

const authRoutes = require('./src/routes/auth');
const supportRoutes = require('./src/routes/support');
const adminClientsRoutes = require('./src/routes/admin/clients');
const adminSupportRoutes = require('./src/routes/admin/support');
const adminTemplatesRoutes = require('./src/routes/admin/templates');
const adminReviewRoutes = require('./src/routes/admin/review');
const clientOnboardingRoutes = require('./src/routes/client/onboarding');
const clientDocumentsRoutes = require('./src/routes/client/documents');
const clientTemplatesRoutes = require('./src/routes/client/templates');
const clientStatusRoutes = require('./src/routes/client/status');

ensureDir(config.paths.uploads);
ensureDir(path.join(config.paths.uploads, 'templates'));

const app = express();
const BASE = '/client-portal';

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(`${BASE}/public`, express.static(config.paths.public));

const pageRoutes = [
  ['/admin/dashboard', 'admin/dashboard.html'],
  ['/admin/clients/new', 'admin/client-new.html'],
  ['/admin/templates', 'admin/templates.html'],
  ['/client/dashboard', 'client/dashboard.html'],
  ['/privacy-policy', 'legal/privacy-policy.html'],
  ['/terms-of-use', 'legal/terms-of-use.html'],
];

app.get(`${BASE}/`, (req, res) => {
  res.sendFile(path.join(config.paths.public, 'client-login.html'));
});

for (const [route, file] of pageRoutes) {
  app.get(`${BASE}${route}`, (req, res) => {
    res.sendFile(path.join(config.paths.views, file));
  });
}

app.get(`${BASE}/client/login`, (req, res) => {
  res.redirect(`${BASE}/`);
});

app.get(`${BASE}/admin/login`, (req, res) => {
  res.redirect(`${BASE}/`);
});

app.get(`${BASE}/admin/clients/:id`, (req, res) => {
  res.sendFile(path.join(config.paths.views, 'admin/client-detail.html'));
});

app.use(`${BASE}/api/auth`, authRoutes);
app.use(`${BASE}/api/support`, supportRoutes);
app.use(`${BASE}/api/admin/clients`, adminClientsRoutes);
app.use(`${BASE}/api/admin/support-requests`, adminSupportRoutes);
app.use(`${BASE}/api/admin/templates`, adminTemplatesRoutes);
app.use(`${BASE}/api/admin`, adminReviewRoutes);
app.use(`${BASE}/api/client/onboarding`, clientOnboardingRoutes);
app.use(`${BASE}/api/client/documents`, clientDocumentsRoutes);
app.use(`${BASE}/api/client/templates`, clientTemplatesRoutes);
app.use(`${BASE}/api/client/status`, clientStatusRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(config.port, () => {
  console.log(`Client Portal running at http://localhost:${config.port}${BASE}/`);
});
