const mongoose = require('mongoose');
const SubstituteRequestSchema = new mongoose.Schema({
  absentTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  periodNumber: { type: Number, required: true },
  subject: { type: String, required: true },
  className: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  dayOfWeek: { type: String, required: true },
  date: { type: Date, required: true },
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  leave: { type: mongoose.Schema.Types.ObjectId, ref: 'Leave', default: null },
  declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['open', 'accepted', 'declined_all', 'hod_approved', 'principal_approved'], default: 'open' },
}, { timestamps: true });
SubstituteRequestSchema.index({ leave: 1, date: 1, periodNumber: 1 }, { unique: true, partialFilterExpression: { leave: { $type: 'objectId' } } });
SubstituteRequestSchema.index({ substituteTeacher: 1, date: 1, periodNumber: 1 }, { unique: true, partialFilterExpression: { substituteTeacher: { $type: 'objectId' }, status: { $in: ['accepted', 'hod_approved', 'principal_approved'] } } });
module.exports = mongoose.models.SubstituteRequest || mongoose.model('SubstituteRequest', SubstituteRequestSchema);
