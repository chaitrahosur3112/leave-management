const Timetable = require('../models/Timetable');

// GET /api/timetable/my
exports.getMyTimetable = async (req, res) => {
  try {
    const tt = await Timetable.find({ teacher: req.user._id });
    res.json(tt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/timetable  — HOD/Principal sets timetable
exports.setTimetable = async (req, res) => {
  try {
    const { teacherId, dayOfWeek, periods } = req.body;
    if (!teacherId || !dayOfWeek || !periods) {
      return res.status(400).json({ message: 'teacherId, dayOfWeek and periods required' });
    }
    const tt = await Timetable.findOneAndUpdate(
      { teacher: teacherId, dayOfWeek },
      { teacher: teacherId, dayOfWeek, periods },
      { upsert: true, new: true }
    );
    res.json(tt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};