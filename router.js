// router.js
const express = require('express');
const router = express.Router();

// ✅ Basic test route
router.get('/api/test', (req, res) => {
  res.send('Router file is working ✅');
});

module.exports = router;
