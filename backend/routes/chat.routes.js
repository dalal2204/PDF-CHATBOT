const express = require('express');
const controller = require('../controllers/chat.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router({ mergeParams: true });
router.get('/', asyncHandler(controller.history));
router.post('/', asyncHandler(controller.ask));
router.delete('/', asyncHandler(controller.clear));
module.exports = router;
