// controllers/timetableController.js
const Timetable = require('../models/Timetable');

// GET /api/timetable/my  — logged-in teacher's own timetable
exports.getMyTimetable = async (req, res) => {
  try {
    const tt = await Timetable.findOne({ teacher: req.user._id });
    // Return days array (or empty array if no timetable yet)
    res.json(tt ? tt.days : []);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/timetable/all  — admin: all timetables
exports.getAllTimetables = async (req, res) => {
  try {
    const all = await Timetable.find().populate('teacher', 'name email role');
    res.json(all);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};