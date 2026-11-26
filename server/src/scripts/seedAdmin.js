const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) { console.log('ADMIN_EMAIL/ADMIN_PASSWORD not configured; skipping admin seed.'); return; }
  const email = env.ADMIN_EMAIL.toLowerCase(); const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) { if (existing.role !== 'admin') { existing.role = 'admin'; existing.status = 'approved'; await existing.save(); } console.log('Configured admin account already exists; password was not reset.'); return; }
  await User.create({ name: env.ADMIN_NAME, email, passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12), role: 'admin', status: 'approved' });
  console.log(`Created initial admin account: ${email}`);
}
module.exports = seedAdmin;
