// models/SubstituteRequest.js
// NEW FLOW:
//   open        → request sent to free same-class teachers, waiting for acceptance
//   accepted    → a free teacher accepted → leave auto-created → goes to HOD
//   declined    → all teachers declined (no one available)
//   hod_approved → HOD confirmed the substitute assignment

const mongoose = require('mongoose');

const SubstituteRequestSchema = new mongoose.Schema({
  // Who needs the substitute
  absentTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Which period needs coverage
  periodNumber: { type: Number,  required: true },
  subject:      { type: String,  required: true },
  className:    { type: String,  required: true },   // used to find same-class teachers
  startTime:    { type: String,  required: true },
  endTime:      { type: String,  required: true },
  dayOfWeek:    { type: String,  required: true },
  date:         { type: Date,    required: true },   // exact leave date

  // Which teacher accepted (filled when accepted)
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Linked leave (created AFTER acceptance)
  leave: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave', default: null },

  // Teachers who declined (so we don't show them again)
  declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  status: {
    type: String,
    enum: ['open', 'accepted', 'declined_all', 'hod_approved'],
    default: 'open',
  },
}, { timestamps: true });

module.exports = mongoose.model('SubstituteRequest', SubstituteRequestSchema);