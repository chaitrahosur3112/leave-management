const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: String, enum: ['casual', 'sick', 'emergency', 'paternity/maternity'], default: 'casual' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, default: '' },
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  substituteRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubstituteRequest' }],
  status: { type: String, enum: ['coverage_pending', 'substitute_confirmed', 'submitted', 'hod_approved', 'principal_approved', 'rejected'], default: 'coverage_pending' },
  coverageCompletedAt: Date,
  submittedAt: Date,
  hodApprovedAt: Date,
  principalApprovedAt: Date,
  balancePostedAt: Date,
  rejectedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
}, { timestamps: true });

module.exports = mongoose.models.Leave || mongoose.model('Leave', LeaveSchema);
