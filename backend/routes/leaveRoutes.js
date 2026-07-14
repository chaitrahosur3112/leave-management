// routes/leaveRoutes.js
const express = require('express');
const r = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const C = require('../controllers/leaveController');

r.get('/my',                      protect,                               C.getMyLeaves);
r.get('/balance',                 protect,                               C.getLeaveBalance);
r.get('/all',                     protect, authorize('hod','principal'), C.getAllLeaves);

// NEW: Teacher fills leave details AFTER substitute accepts
r.patch('/:id/details',           protect,                               C.fillLeaveDetails);

r.patch('/:id/hod-approve',       protect, authorize('hod'),             C.hodApprove);
r.patch('/:id/principal-approve', protect, authorize('principal'),       C.principalApprove);
r.patch('/:id/reject',            protect, authorize('hod','principal'), C.rejectLeave);

// Old route kept for backward compat
r.post('/',                       protect,                               C.applyLeave);

module.exports = r;