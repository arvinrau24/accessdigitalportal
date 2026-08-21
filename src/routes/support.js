const express = require('express');
const pool = require('../db');
const { supportRequestLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const REQUEST_TYPES = ['password_reset', 'general_support'];

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

router.post('/requests', supportRequestLimiter, async (req, res) => {
  try {
    const requestType = cleanString(req.body.requestType, 40);
    const companyName = cleanString(req.body.companyName, 255);
    const accountIdentifier = cleanString(req.body.accountIdentifier, 150);
    const message = cleanString(req.body.message, 2000);

    if (!REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({ success: false, error: 'Invalid support request type' });
    }
    if (!companyName || !accountIdentifier) {
      return res.status(400).json({ success: false, error: 'Company name and account identifier are required' });
    }
    if (requestType === 'general_support' && !message) {
      return res.status(400).json({ success: false, error: 'Please describe how we can help' });
    }

    // Matching is used only to help an administrator handle the request. The
    // public response intentionally does not reveal whether an account exists.
    const [clientRows] = await pool.query(
      'SELECT id FROM clients WHERE client_login_id = ? AND company_name = ? LIMIT 1',
      [accountIdentifier, companyName]
    );
    const clientId = clientRows[0]?.id || null;

    await pool.query(
      `INSERT INTO support_requests
        (request_type, company_name, account_identifier, message, client_id)
       VALUES (?, ?, ?, ?, ?)`,
      [requestType, companyName, accountIdentifier, message || null, clientId]
    );

    return res.status(201).json({
      success: true,
      message: 'Your request has been received. Our support team will be in touch.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Unable to submit your request at this time' });
  }
});

module.exports = router;