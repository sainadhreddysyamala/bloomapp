const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.bv_token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Please log in.' });
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub).populate('worker', 'workerCode fullName');
    if (!user || !user.isActive) return res.status(401).json({ message: 'Account is unavailable.' });
    if (user.role !== 'admin' && user.status !== 'approved') return res.status(403).json({ message: 'Your account is awaiting administrator approval.' });
    req.user = user;
    next();
  } catch (e) { return res.status(401).json({ message: 'Session expired. Please log in again.' }); }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
  next();
}
module.exports = { requireAuth, requireAdmin };
