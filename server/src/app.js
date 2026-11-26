const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const aiRoutes = require('./routes/ai');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const AuditLog = require('./models/AuditLog');
const User = require('./models/User');
const Worker = require('./models/Worker');
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map(s => s.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' })); app.use(cookieParser());
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (req,res) => res.json({ status: 'ok', service: 'BloomVoice', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes); app.use('/api/workers', workerRoutes); app.use('/api/ai', aiRoutes);
app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (req,res,next) => { try { const logs = await AuditLog.find().populate('actor','name email').sort({ createdAt: -1 }).limit(200).lean(); res.json({ logs }); } catch(e) { next(e); } });
app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (req,res,next) => { try { const [workers, users, pending] = await Promise.all([Worker.countDocuments({isActive:true}), User.countDocuments({role:'user',isActive:true,status:'approved'}), User.countDocuments({role:'user',status:'pending'})]); res.json({workers, users, pending}); } catch(e) { next(e); } });
// Production serves the built Vite app from client/dist.
const path = require('path'); const fs = require('fs'); const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (req,res,next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(dist,'index.html'))); }
app.use((err, req, res, next) => {
  if (err.name === 'ZodError') return res.status(400).json({ message: 'Please check the submitted fields.', errors: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  if (err.code === 11000) return res.status(409).json({ message: 'This record already exists.' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid record identifier.' });
  console.error(err); res.status(500).json({ message: env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message || 'Server error.' });
});
module.exports = app;
