// LeaveBalance.js
const mongoose = require('mongoose');
const s = new mongoose.Schema({
  teacher:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year:            { type: Number, required: true },
  firstHalfTotal:  { type: Number, default: 7 },
  firstHalfUsed:   { type: Number, default: 0 },
  secondHalfTotal: { type: Number, default: 8 },
  secondHalfUsed:  { type: Number, default: 0 },
}, { timestamps: true });
s.index({ teacher:1, year:1 }, { unique: true });
module.exports = mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', LeaveSchema);