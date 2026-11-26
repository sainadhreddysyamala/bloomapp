const AuditLog = require('../models/AuditLog');
async function audit(req, action, entityType = '', entityId = '', details = {}) {
  try { await AuditLog.create({ actor: req.user?._id || null, action, entityType, entityId: String(entityId || ''), details, ip: req.ip || '' }); }
  catch (e) { console.error('Audit log write failed:', e.message); }
}
module.exports = audit;
