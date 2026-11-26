const { z } = require('zod');
const ExcelJS = require('exceljs');
const Worker = require('../models/Worker');
const DailyRecord = require('../models/DailyRecord');
const audit = require('../utils/audit');
const workerSchema = z.object({ workerCode: z.string().trim().min(1).max(30), fullName: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).optional().default(''), department: z.string().trim().max(80).optional().default('Flower sorting'), notes: z.string().trim().max(1000).optional().default('') });
const recordSchema = z.object({ workerId: z.string().min(1), businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), attendance: z.enum(['present','absent']), morga: z.coerce.number().min(0).max(100000000).default(0), jasmine: z.coerce.number().min(0).max(100000000).default(0), unit: z.string().trim().max(20).default('kg'), notes: z.string().trim().max(1000).default(''), inputSource: z.enum(['manual','voice']).default('manual'), originalTranscript: z.string().max(5000).default('') });
function canAccessWorker(req, workerId) { return req.user.role === 'admin' || (req.user.worker && String(req.user.worker._id || req.user.worker) === String(workerId)); }
exports.listWorkers = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : (req.user.worker ? { _id: req.user.worker._id || req.user.worker } : { _id: null });
    if (req.query.includeInactive === 'true' && req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
    if (req.query.includeInactive !== 'true') filter.isActive = true;
    const workers = await Worker.find(filter).sort({ fullName: 1 }); res.json({ workers });
  } catch (e) { next(e); }
};
exports.createWorker = async (req, res, next) => {
  try { const input = workerSchema.parse(req.body); const worker = await Worker.create({ ...input, createdBy: req.user._id }); await audit(req, 'worker.created', 'Worker', worker._id, { workerCode: worker.workerCode }); res.status(201).json({ worker }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'Worker code already exists.' }); next(e); }
};
exports.updateWorker = async (req, res, next) => {
  try { const input = workerSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body); const worker = await Worker.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true }); if (!worker) return res.status(404).json({ message: 'Worker not found.' }); await audit(req, 'worker.updated', 'Worker', worker._id, input); res.json({ worker }); }
  catch (e) { next(e); }
};
exports.deleteWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (!worker.isActive) return res.status(409).json({ message: 'Worker is already inactive.' });
    worker.isActive = false;
    await worker.save();
    await audit(req, 'worker.deactivated', 'Worker', worker._id, { workerCode: worker.workerCode, fullName: worker.fullName, historicalRecordsPreserved: true });
    res.json({ message: 'Worker deactivated. Historical records have been preserved.', worker });
  } catch (e) { next(e); }
};

exports.getMonthlyTiffinReport = async (req, res, next) => {
  try {
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'month must be YYYY-MM.' });
    const workerFilter = req.user.role === 'admin' ? {} : (req.user.worker ? { _id: req.user.worker._id || req.user.worker } : { _id: null });
    const workers = await Worker.find(workerFilter).sort({ fullName: 1 }).lean();
    const records = await DailyRecord.find({ businessDate: { $regex: `^${month}-` }, worker: { $in: workers.map(w => w._id) } }).select('worker businessDate notes').lean();
    const byWorker = new Map();
    for (const record of records) {
      // T is a standalone marker in the optional Notes field (e.g. "T" or "T, extra note").
      if (!/(^|[^a-z])t([^a-z]|$)/i.test(String(record.notes || ''))) continue;
      const id = String(record.worker);
      if (!byWorker.has(id)) byWorker.set(id, new Set());
      byWorker.get(id).add(record.businessDate);
    }
    const rows = workers.map(w => {
      const dates = [...(byWorker.get(String(w._id)) || new Set())].sort();
      return { workerId: String(w._id), workerCode: w.workerCode, fullName: w.fullName, tiffinDates: dates, tiffinDays: dates.length, tiffinAmount: dates.length * 25 };
    });
    res.json({ month, rows, totals: { tiffinDays: rows.reduce((n, r) => n + r.tiffinDays, 0), tiffinAmount: rows.reduce((n, r) => n + r.tiffinAmount, 0) } });
  } catch (e) { next(e); }
};

exports.getDailyReport = async (req, res, next) => {
  try {
    const date = String(req.query.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'date must be YYYY-MM-DD.' });
    const workerFilter = req.user.role === 'admin' ? { isActive: true } : (req.user.worker ? { _id: req.user.worker._id || req.user.worker, isActive: true } : { _id: null });
    const workers = await Worker.find(workerFilter).sort({ fullName: 1 }).lean();
    const records = await DailyRecord.find({ businessDate: date, worker: { $in: workers.map(w => w._id) } }).lean();
    const byWorker = new Map(records.map(r => [String(r.worker), r]));
    const rows = workers.map(w => { const r = byWorker.get(String(w._id)); return { workerId: String(w._id), workerCode: w.workerCode, fullName: w.fullName, attendance: r?.attendance || 'unmarked', morga: r?.morga || 0, jasmine: r?.jasmine || 0, unit: r?.unit || 'kg', notes: r?.notes || '', recordId: r?._id || null, inputSource: r?.inputSource || 'manual' }; });
    const totals = rows.reduce((a, r) => { if (r.attendance === 'present') { a.morga += r.morga; a.jasmine += r.jasmine; a.present += 1; } if (r.attendance === 'absent') a.absent += 1; a.unmarked += r.attendance === 'unmarked' ? 1 : 0; return a; }, { morga: 0, jasmine: 0, present: 0, absent: 0, unmarked: 0, workers: rows.length });
    res.json({ date, rows, totals });
  } catch (e) { next(e); }
};
exports.saveDailyRecord = async (req, res, next) => {
  try {
    const input = recordSchema.parse(req.body);
    if (!canAccessWorker(req, input.workerId)) return res.status(403).json({ message: 'You cannot edit another worker\'s records.' });
    const worker = await Worker.findById(input.workerId); if (!worker || !worker.isActive) return res.status(404).json({ message: 'Active worker not found.' });
    const record = await DailyRecord.findOneAndUpdate({ worker: worker._id, businessDate: input.businessDate }, { $set: { attendance: input.attendance, morga: input.attendance === 'absent' ? 0 : input.morga, jasmine: input.attendance === 'absent' ? 0 : input.jasmine, unit: input.unit, notes: input.notes, inputSource: input.inputSource, originalTranscript: input.originalTranscript, updatedBy: req.user._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    await audit(req, 'daily_record.saved', 'DailyRecord', record._id, { worker: worker._id, businessDate: input.businessDate, attendance: record.attendance, morga: record.morga, jasmine: record.jasmine });
    res.json({ record });
  } catch (e) { next(e); }
};
exports.insertDailyRecord = async (req, res, next) => {
  try {
    const input = recordSchema.parse(req.body);
    if (!canAccessWorker(req, input.workerId)) return res.status(403).json({ message: 'You cannot edit another worker\'s records.' });
    const worker = await Worker.findById(input.workerId);
    if (!worker || !worker.isActive) return res.status(404).json({ message: 'Active worker not found.' });
    const exists = await DailyRecord.findOne({ worker: worker._id, businessDate: input.businessDate });
    if (exists) return res.status(409).json({ message: 'A record already exists for this worker and date. Use Update instead.' });
    const record = await DailyRecord.create({ worker: worker._id, businessDate: input.businessDate, attendance: input.attendance, morga: input.attendance === 'absent' ? 0 : input.morga, jasmine: input.attendance === 'absent' ? 0 : input.jasmine, unit: input.unit, notes: input.notes, inputSource: input.inputSource, originalTranscript: input.originalTranscript, createdBy: req.user._id, updatedBy: req.user._id });
    await audit(req, 'daily_record.inserted', 'DailyRecord', record._id, { worker: worker._id, businessDate: input.businessDate });
    res.status(201).json({ record });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'A record already exists for this worker and date. Use Update instead.' }); next(e); }
};
exports.updateDailyRecord = async (req, res, next) => {
  try {
    const input = recordSchema.parse(req.body);
    if (!canAccessWorker(req, input.workerId)) return res.status(403).json({ message: 'You cannot edit another worker\'s records.' });
    const worker = await Worker.findById(input.workerId);
    if (!worker || !worker.isActive) return res.status(404).json({ message: 'Active worker not found.' });
    const record = await DailyRecord.findOneAndUpdate({ worker: worker._id, businessDate: input.businessDate }, { $set: { attendance: input.attendance, morga: input.attendance === 'absent' ? 0 : input.morga, jasmine: input.attendance === 'absent' ? 0 : input.jasmine, unit: input.unit, notes: input.notes, inputSource: input.inputSource, originalTranscript: input.originalTranscript, updatedBy: req.user._id } }, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ message: 'No record exists for this worker and date. Use Insert instead.' });
    await audit(req, 'daily_record.updated', 'DailyRecord', record._id, { worker: worker._id, businessDate: input.businessDate });
    res.json({ record });
  } catch (e) { next(e); }
};
exports.clearDailyRecords = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access required to clear daily records.' });
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'date must be YYYY-MM-DD.' });
    const result = await DailyRecord.deleteMany({ businessDate: date });
    await audit(req, 'daily_records.cleared', 'DailyRecord', date, { businessDate: date, deletedCount: result.deletedCount || 0 });
    res.json({ message: `Cleared ${result.deletedCount || 0} record(s) for ${date}.`, deletedCount: result.deletedCount || 0 });
  } catch (e) { next(e); }
};

exports.exportDailyExcel = async (req, res, next) => {
  try {
    const date = String(req.query.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'date must be YYYY-MM-DD.' });
    const report = await exports._buildReport(req, date);
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'BloomVoice'; workbook.created = new Date();
    const sheet = workbook.addWorksheet('Worker Details');
    sheet.columns = [ { header: 'Worker ID', key: 'workerCode', width: 16 }, { header: 'Worker Name', key: 'fullName', width: 28 }, { header: 'Date', key: 'date', width: 15 }, { header: 'Attendance', key: 'attendance', width: 16 }, { header: 'Morga Quantity', key: 'morga', width: 18 }, { header: 'Jasmine Quantity', key: 'jasmine', width: 18 }, { header: 'Total Quantity', key: 'total', width: 18 }, { header: 'Unit', key: 'unit', width: 12 }, { header: 'Notes', key: 'notes', width: 34 } ];
    sheet.addRows(report.rows.map(r => ({ ...r, date, total: r.attendance === 'present' ? r.morga + r.jasmine : 0 })));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D3B76' } }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = 'A1:I1';
    const summary = workbook.addWorksheet('Daily Summary'); summary.columns = [{ header: 'Metric', key: 'metric', width: 28 }, { header: 'Value', key: 'value', width: 22 }];
    summary.addRows([{ metric: 'Business date', value: date }, { metric: 'Total workers', value: report.totals.workers }, { metric: 'Present', value: report.totals.present }, { metric: 'Absent', value: report.totals.absent }, { metric: 'Unmarked', value: report.totals.unmarked }, { metric: 'Total Morga', value: report.totals.morga }, { metric: 'Total Jasmine', value: report.totals.jasmine }, { metric: 'Combined flower quantity', value: report.totals.morga + report.totals.jasmine }, { metric: 'Unit', value: 'As recorded per worker' }]); summary.getRow(1).font = { bold: true }; summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEADCF0' } };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename="bloomvoice-workers-${date}.xlsx"`); await workbook.xlsx.write(res); res.end();
  } catch (e) { next(e); }
};
exports._buildReport = async (req, date) => {
  const workerFilter = req.user.role === 'admin' ? { isActive: true } : (req.user.worker ? { _id: req.user.worker._id || req.user.worker, isActive: true } : { _id: null });
  const workers = await Worker.find(workerFilter).sort({ fullName: 1 }).lean(); const records = await DailyRecord.find({ businessDate: date, worker: { $in: workers.map(w => w._id) } }).lean(); const byWorker = new Map(records.map(r => [String(r.worker), r]));
  const rows = workers.map(w => { const r = byWorker.get(String(w._id)); return { workerCode: w.workerCode, fullName: w.fullName, attendance: r?.attendance || 'unmarked', morga: r?.morga || 0, jasmine: r?.jasmine || 0, unit: r?.unit || 'kg', notes: r?.notes || '' }; });
  const totals = rows.reduce((a,r) => { if (r.attendance === 'present') { a.morga += r.morga; a.jasmine += r.jasmine; a.present++; } if (r.attendance === 'absent') a.absent++; if (r.attendance === 'unmarked') a.unmarked++; return a; }, { workers: rows.length, morga: 0, jasmine: 0, present: 0, absent: 0, unmarked: 0 }); return { rows, totals };
};
