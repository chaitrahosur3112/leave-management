// models/Timetable.js
// Each teacher has one timetable document.
// It contains an array of days, each day has periods.
// period.className is used to find "same class" teachers for substitution.

const mongoose = require('mongoose');

const PeriodSchema = new mongoose.Schema({
  periodNumber: { type: Number, required: true },   // 1, 2, 3 ...
  subject:      { type: String, required: true },   // "Physics"
  className:    { type: String, required: true },   // "10A", "11B"
  startTime:    { type: String, required: true },   // "09:00"
  endTime:      { type: String, required: true },   // "09:45"
}, { _id: false });

const DaySchema = new mongoose.Schema({
  dayOfWeek: { type: String, required: true,
    enum: ['Monday','Tuesday','Wednesday','Thursday','Friday'] },
  periods: [PeriodSchema],
}, { _id: false });

const TimetableSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  days:    [DaySchema],
}, { timestamps: true });

module.exports = mongoose.model('Timetable', TimetableSchema);