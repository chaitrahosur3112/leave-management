const SubstituteRequest = require('../models/SubstituteRequest');
const Leave             = require('../models/Leave');
const User              = require('../models/User');

// GET /api/substitutes/my  — teacher sees requests sent to them
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await SubstituteRequest.find({
      requestedTo: req.user._id,
      status:      { $in: ['open', 'open_all'] }
    })
      .populate('absentTeacher', 'name email')
      .populate('leave', 'reason leaveType startDate');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/substitutes/:id/accept
exports.acceptRequest = async (req, res) => {
  try {
    const request = await SubstituteRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!['open','open_all'].includes(request.status)) {
      return res.status(400).json({ message: 'This request is no longer available' });
    }

    request.substituteTeacher = req.user._id;
    request.status            = 'accepted';
    await request.save();

    // Update parent leave status
    const leave = await Leave.findById(request.leave);
    if (leave && leave.status === 'pending') {
      leave.status = 'substitute_assigned';
      await leave.save();
    }

    res.json({ message: 'Accepted successfully', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/substitutes/:id/decline
exports.declineRequest = async (req, res) => {
  try {
    const request = await SubstituteRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Add to rejectedBy
    if (!request.rejectedBy.map(String).includes(String(req.user._id))) {
      request.rejectedBy.push(req.user._id);
    }
    // Remove this teacher from requestedTo
    request.requestedTo = request.requestedTo.filter(
      id => String(id) !== String(req.user._id)
    );

    // If all same-class teachers declined → escalate to all free teachers
    if (request.status === 'open' && request.requestedTo.length === 0) {
      const allTeachers = await User.find({
        _id:  { $nin: [...request.rejectedBy, request.absentTeacher] },
        role: 'teacher'
      });
      request.requestedTo = allTeachers.map(t => t._id);
      request.status      = 'open_all';
    }

    await request.save();
    res.json({ message: 'Declined', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/substitutes/all  — HOD/Principal
exports.getAllSubRequests = async (req, res) => {
  try {
    const requests = await SubstituteRequest.find({
      status: { $in: ['accepted', 'hod_approved'] }
    })
      .populate('absentTeacher',     'name email')
      .populate('substituteTeacher', 'name email')
      .populate('leave', 'startDate endDate status leaveType');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/substitutes/:id/hod-approve
exports.hodApproveSubstitute = async (req, res) => {
  try {
    const request = await SubstituteRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Not found' });
    request.status = 'hod_approved';
    await request.save();
    res.json({ message: 'Substitute confirmed by HOD', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/substitutes/:id/principal-approve
exports.principalApproveSubstitute = async (req, res) => {
  try {
    const request = await SubstituteRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Not found' });
    request.status = 'principal_approved';
    await request.save();
    res.json({ message: 'Substitute approved by Principal', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};