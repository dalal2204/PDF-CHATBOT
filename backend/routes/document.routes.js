const express = require('express');
const controller = require('../controllers/document.controller');
const upload = require('../middlewares/upload.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', asyncHandler(controller.list));
router.post('/', upload.single('pdf'), asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));
router.delete('/:id', asyncHandler(controller.remove));
module.exports = router;
