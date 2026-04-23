const mongoose = require('mongoose');
const periodSchema = new mongoose.Schema({
  periodNumber: Number,
  startTime:    String,
  endTime:      String,
  subject:      String,
  className:    String,
});
const s = new mongoose.Schema({
  teacher:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayOfWeek: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
  periods:   [periodSchema],
}, { timestamps: true });
module.exports = mongoose.model('Timetable', s);