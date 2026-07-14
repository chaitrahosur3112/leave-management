// controllers/leaveController.js
// Leave is created automatically when substitute accepts.
// Teacher then fills in reason + leaveType via PATCH /api/leaves/:id/details
// HOD sees only "substitute_confirmed" leaves.

const Leave    = require('../models/Leave');
const User     = require('../models/User'); // adjust if your model is named differently

// ─────────────────────────────────────────────────────────────────
// GET /api/leaves/my  — teacher sees their own leaves
// ─────────────────────────────────────────────────────────────────
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ teacher: req.user._id })
      .populate('substituteTeacher', 'name email')
      .populate('substituteRequests')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/leaves/balance  — teacher's leave balance
// ─────────────────────────────────────────────────────────────────
exports.getLeaveBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      firstHalfTotal:  user.firstHalfTotal  || 7,
      firstHalfUsed:   user.firstHalfUsed   || 0,
      secondHalfTotal: user.secondHalfTotal || 8,
      secondHalfUsed:  user.secondHalfUsed  || 0,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/details
// Teacher fills in reason + leaveType + endDate after substitute accepts
// This is the "Leave Application Form" that appears after acceptance
// ─────────────────────────────────────────────────────────────────
exports.fillLeaveDetails = async (req, res) => {
  try {
    const { reason, leaveType, endDate } = req.body;
    const leave = await Leave.findOne({ _id: req.params.id, teacher: req.user._id });
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'substitute_confirmed') {
      return res.status(400).json({ message: 'Leave is already submitted.' });
    }
    if (!reason || !leaveType) {
      return res.status(400).json({ message: 'reason and leaveType are required.' });
    }

    leave.reason    = reason.trim();
    leave.leaveType = leaveType;
    if (endDate) leave.endDate = new Date(endDate + 'T00:00:00');

    // Status stays "substitute_confirmed" — HOD will see it
    await leave.save();
    await leave.populate('substituteTeacher', 'name email');
    res.json({ message: 'Leave details saved. HOD will now review.', leave });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/leaves/all  — HOD / Principal sees all leaves
// HOD only sees substitute_confirmed (ready to approve)
// ─────────────────────────────────────────────────────────────────
exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate('teacher',           'name email')
      .populate('substituteTeacher', 'name email')
      .populate('substituteRequests')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/hod-approve
// HOD approves — only if substitute is confirmed
// ─────────────────────────────────────────────────────────────────
exports.hodApprove = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Not found' });

    if (leave.status !== 'substitute_confirmed') {
      return res.status(400).json({
        message: 'Cannot approve: substitute has not been confirmed yet.'
      });
    }

    leave.status        = 'hod_approved';
    leave.hodApprovedAt = new Date();
    await leave.save();
    await leave.populate('teacher substituteTeacher', 'name email');
    res.json({ message: 'HOD approved. Sent to Principal.', leave });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/principal-approve
// Principal gives final approval — deducts leave balance
// ─────────────────────────────────────────────────────────────────
exports.principalApprove = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('teacher');
    if (!leave) return res.status(404).json({ message: 'Not found' });

    leave.status             = 'principal_approved';
    leave.principalApprovedAt = new Date();
    await leave.save();

    // Deduct from teacher's balance
    const start = new Date(leave.startDate);
    const end   = new Date(leave.endDate);
    const days  = Math.ceil((end - start) / 86400000) + 1;
    const month = start.getMonth() + 1; // 1–12

    const update = month <= 6
      ? { $inc: { firstHalfUsed:  days } }
      : { $inc: { secondHalfUsed: days } };

    const updatedUser = await User.findByIdAndUpdate(
    leave.teacher._id,
    update,
    { new: true }
  );

console.log("Updated User:", updatedUser);

    res.json({ message: `Fully approved! ${days} day(s) deducted.`, leave });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/reject
// ─────────────────────────────────────────────────────────────────
exports.rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    ).populate('teacher substituteTeacher', 'name email');
    if (!leave) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Leave rejected.', leave });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Keep old applyLeave for backward compat (not used in new flow)
exports.applyLeave = async (req, res) => {
  res.status(400).json({
    message: 'Direct leave application is disabled. Please use "Request Substitute" first.'
  });
};