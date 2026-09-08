// controllers/leaveController.js — FIXED
// Uses LeaveBalance model (your existing system) for balance read/write
// Added privilegedLeaves from User model

const Leave        = require('../models/Leave');
const User         = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');

// ─────────────────────────────────────────────────────────────────
// GET /api/leaves/my
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
// GET /api/leaves/balance
// Reads from LeaveBalance model + privilegedLeaves from User
// ─────────────────────────────────────────────────────────────────
exports.getLeaveBalance = async (req, res) => {
  try {
    const year = new Date().getFullYear();

    // Get or auto-create LeaveBalance for this teacher + year
    let bal = await LeaveBalance.findOne({ teacher: req.user._id, year });
    if (!bal) {
      bal = await LeaveBalance.create({
        teacher:         req.user._id,
        year,
        firstHalfTotal:  7,
        firstHalfUsed:   0,
        secondHalfTotal: 8,
        secondHalfUsed:  0,
      });
    }

    // Get privilegedLeaves from User model (carry-over from last year)
    const user = await User.findById(req.user._id);

    res.json({
      firstHalfTotal:   bal.firstHalfTotal,
      firstHalfUsed:    bal.firstHalfUsed,
      secondHalfTotal:  bal.secondHalfTotal,
      secondHalfUsed:   bal.secondHalfUsed,
      privilegedLeaves: user?.privilegedLeaves || 0,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/details
// Teacher fills reason + leaveType + startDate + endDate
// after substitute accepts
// ─────────────────────────────────────────────────────────────────
exports.fillLeaveDetails = async (req, res) => {
  try {
    const { reason, leaveType, startDate, endDate } = req.body;
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
    if (startDate) leave.startDate = new Date(startDate + 'T00:00:00');
    if (endDate)   leave.endDate   = new Date(endDate   + 'T00:00:00');

    await leave.save();
    await leave.populate('substituteTeacher', 'name email');
    res.json({ message: 'Leave details saved. HOD will now review.', leave });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/leaves/all — HOD / Principal sees all leaves
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
// HOD approves — only when substitute is confirmed
// ─────────────────────────────────────────────────────────────────
exports.hodApprove = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Not found' });
    if (leave.status !== 'substitute_confirmed') {
      return res.status(400).json({ message: 'Cannot approve: substitute not confirmed yet.' });
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
// Final approval — deducts from LeaveBalance (your existing model)
// ─────────────────────────────────────────────────────────────────
exports.principalApprove = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('teacher');
    if (!leave) return res.status(404).json({ message: 'Not found' });

    leave.status              = 'principal_approved';
    leave.principalApprovedAt = new Date();
    await leave.save();

    // Calculate number of leave days
    const start = new Date(leave.startDate);
    const end   = new Date(leave.endDate);
    const days  = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
    const month = start.getMonth() + 1; // 1-12
    const year  = start.getFullYear();

    // Deduct from LeaveBalance using your existing model
    const field = month <= 6 ? 'firstHalfUsed' : 'secondHalfUsed';
    const updatedBal = await LeaveBalance.findOneAndUpdate(
      { teacher: leave.teacher._id, year },
      { $inc: { [field]: days } },
      { new: true, upsert: true }  // create if doesn't exist
    );

    console.log(`✅ Balance deducted for ${leave.teacher.name}: ${field} += ${days} → now ${updatedBal[field]}`);

    res.json({
      message: `Fully approved! ${days} day(s) deducted from balance.`,
      leave,
      updatedBalance: {
        firstHalfUsed:  updatedBal.firstHalfUsed,
        secondHalfUsed: updatedBal.secondHalfUsed,
      },
    });
  } catch (e) {
    console.error('principalApprove error:', e);
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

// Kept for backward compat — not used in new workflow
exports.applyLeave = async (req, res) => {
  res.status(400).json({
    message: 'Direct leave application is disabled. Please use "Request Substitute" first.'
  });
};