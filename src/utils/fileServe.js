const fs = require('fs');
const path = require('path');

function sendFile(res, filePath, downloadName) {
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  return res.download(filePath, downloadName || path.basename(filePath));
}

function streamFile(res, filePath, downloadName) {
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName || path.basename(filePath)}"`);
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { sendFile, streamFile };
