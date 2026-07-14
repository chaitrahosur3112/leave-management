// routes/timetableRoutes.js
const express = require('express');
const r = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const C = require('../controllers/timetableController');
console.log(C);

r.get('/my',  protect,                               C.getMyTimetable);
r.get('/all', protect, authorize('hod','principal'), C.getAllTimetables);

module.exports = r;