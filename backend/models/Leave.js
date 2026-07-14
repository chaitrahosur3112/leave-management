// models/Leave.js
// Leave is only created AFTER a substitute teacher accepts.
// Status flow:
//   substitute_confirmed → hod_approved → principal_approved
//                        ↘ rejected

const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  teacher:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: String, enum: ['casual','sick','emergency','paternity/maternity'], default: 'casual' },
  startDate: { type: Date,   required: true },
  endDate:   { type: Date,   required: true },
  reason:    { type: String, default: '' },

  // Substitute who will cover
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Linked substitute requests
  substituteRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubstituteRequest' }],

  status: {
    type: String,
    // substitute_confirmed = substitute accepted, leave now visible to HOD
    enum: ['substitute_confirmed','hod_approved','principal_approved','rejected'],
    default: 'substitute_confirmed',
  },

  hodApprovedAt:       { type: Date },
  principalApprovedAt: { type: Date },
}, { timestamps: true });

module.exports =
  mongoose.models.Leave ||
  mongoose.model('Leave', LeaveSchema);