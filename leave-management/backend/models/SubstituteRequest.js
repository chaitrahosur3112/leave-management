const mongoose = require('mongoose');
const s = new mongoose.Schema({
  leave:             { type: mongoose.Schema.Types.ObjectId, ref: 'Leave', required: true },
  absentTeacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  period: {
    periodNumber: Number, startTime: String,
    endTime: String, subject: String, className: String,
  },
  date:        { type: Date, required: true },
  status: {
    type: String,
    enum: ['open','open_all','accepted','hod_approved','principal_approved'],
    default: 'open'
  },
  requestedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rejectedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });
module.exports = mongoose.model('SubstituteRequest', s);