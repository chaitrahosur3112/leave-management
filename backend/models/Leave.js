const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  teacher:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: String, enum: ['casual','sick','emergency','paternity/maternity'], default: 'casual' },
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  reason:    { type: String, default: '' },

  // Kept for backward compatibility. Multi-period/multi-day leave can have
  // different substitute teachers, so the authoritative assignments live on
  // SubstituteRequest.substituteTeacher.
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Every classroom period that must be covered for this leave.
  substituteRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubstituteRequest' }],

  status: {
    type: String,
    enum: [
      'coverage_pending',      // requests created, not every period accepted yet
      'substitute_confirmed',  // every required period has a substitute
      'hod_approved',
      'principal_approved',
      'rejected',
    ],
    default: 'coverage_pending',
  },

  coverageCompletedAt: { type: Date },
  hodApprovedAt:       { type: Date },
  principalApprovedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.models.Leave || mongoose.model('Leave', LeaveSchema);
