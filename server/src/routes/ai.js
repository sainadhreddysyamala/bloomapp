const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { parseVoice } = require('../controllers/aiController');
router.post('/parse-voice', requireAuth, parseVoice);
module.exports = router;
