const mongoose = require('mongoose');

// Each document is one flower entry OR an attendance-only marker.
// Multiple documents per worker/businessDate are intentional.
const dailyRecordSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  businessDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  recordType: { type: String, enum: ['entry', 'attendance'], default: 'entry', index: true },
  attendance: { type: String, enum: ['present', 'absent'], required: true, default: 'present' },
  morga: { type: Number, min: 0, default: 0 },
  jasmine: { type: Number, min: 0, default: 0 },
  unit: { type: String, trim: true, default: 'kg', maxlength: 20 },
  notes: { type: String, trim: true, default: '' },
  inputSource: { type: String, enum: ['manual', 'voice'], default: 'manual' },
  originalTranscript: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Deliberately non-unique: one worker may have many records on the same date.
dailyRecordSchema.index({ worker: 1, businessDate: 1 }, { name: 'worker_businessDate_nonunique' });

dailyRecordSchema.pre('validate', function(next) {
  if (this.attendance === 'absent' || this.recordType === 'attendance') {
    this.morga = 0;
    this.jasmine = 0;
  }
  next();
});

module.exports = mongoose.model('DailyRecord', dailyRecordSchema);
