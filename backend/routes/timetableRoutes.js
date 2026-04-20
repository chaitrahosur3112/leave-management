const express = require('express');
const r = express.Router();
const { protect, authorize } = require('../middleware/authMiddlewares');
const { getMyTimetable, setTimetable } = require('../controllers/timetableController');
r.get('/my', protect, getMyTimetable);
r.post('/', protect, authorize('hod','principal'), setTimetable);
module.exports = r;