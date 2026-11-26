const mongoose = require('mongoose');
const workerSchema = new mongoose.Schema({
  workerCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, default: '' },
  department: { type: String, trim: true, default: 'Flower sorting' },
  notes: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('Worker', workerSchema);
