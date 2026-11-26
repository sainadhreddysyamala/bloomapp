const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const env = require('../config/env');
const audit = require('../utils/audit');
const registerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(200), password: z.string().min(8).max(100) });
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
function issueCookie(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('bv_token', token, { httpOnly: true, secure: env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000, path: '/' });
}
function safeUser(user) { return { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status, worker: user.worker || null }; }
exports.register = async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ name: input.name, email, passwordHash: await bcrypt.hash(input.password, 12), role: 'user', status: 'pending' });
    await audit({ ...req, user }, 'user.registered', 'User', user._id, { email });
    return res.status(201).json({ message: 'Registration received. An administrator must approve your account before login.', status: 'pending' });
  } catch (e) { next(e); }
};
exports.login = async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash').populate('worker', 'workerCode fullName');
    if (!user || !await bcrypt.compare(input.password, user.passwordHash)) return res.status(401).json({ message: 'Invalid email or password.' });
    if (!user.isActive) return res.status(403).json({ message: 'This account is disabled. Contact an administrator.' });
    if (user.role !== 'admin' && user.status !== 'approved') return res.status(403).json({ message: user.status === 'rejected' ? 'Your registration was rejected.' : 'Your account is awaiting administrator approval.' });
    user.lastLoginAt = new Date(); await user.save(); issueCookie(res, user);
    await audit({ ...req, user }, 'user.login', 'User', user._id);
    res.json({ user: safeUser(user) });
  } catch (e) { next(e); }
};
exports.logout = async (req, res) => { res.clearCookie('bv_token', { httpOnly: true, secure: env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }); res.json({ message: 'Logged out.' }); };
exports.me = (req, res) => res.json({ user: safeUser(req.user) });
exports.listRegistrations = async (req, res, next) => { try { const users = await User.find({ role: 'user' }).select('name email status isActive worker createdAt').populate('worker', 'workerCode fullName').sort({ createdAt: -1 }); res.json({ users }); } catch (e) { next(e); } };
exports.updateUser = async (req, res, next) => {
  try {
    const { status, isActive, workerId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return res.status(404).json({ message: 'User not found.' });
    if (status && ['pending','approved','rejected'].includes(status)) user.status = status;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (workerId !== undefined) user.worker = workerId || null;
    await user.save(); await audit(req, 'user.updated', 'User', user._id, { status: user.status, isActive: user.isActive, worker: user.worker });
    res.json({ user: safeUser(await user.populate('worker', 'workerCode fullName')) });
  } catch (e) { next(e); }
};
