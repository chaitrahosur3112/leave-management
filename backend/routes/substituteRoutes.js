// routes/substituteRoutes.js
const express = require('express');
const r = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const C = require('../controllers/substituteController');

// Teacher sends a substitute request for one period
r.post('/request',              protect,                               C.requestSubstitute);

// Get substitute requests sent TO the logged-in teacher
r.get('/my',                    protect,                               C.getMyRequests);

// Teacher accepts or declines a substitute request
r.patch('/:id/accept',          protect,                               C.acceptRequest);
r.patch('/:id/decline',         protect,                               C.declineRequest);

// HOD / Principal views
r.get('/all',                   protect, authorize('hod','principal'), C.getAllSubRequests);
r.patch('/:id/hod-approve',     protect, authorize('hod'),            C.hodApproveSubstitute);
r.patch('/:id/principal-approve',protect, authorize('principal'),     C.principalApproveSubstitute);

module.exports = r;