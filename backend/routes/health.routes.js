const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
router.get('/', (_req, res) => res.json({
  success: true,
  status: 'ok',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
}));

module.exports = router;
