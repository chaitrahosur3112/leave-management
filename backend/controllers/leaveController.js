const Leave             = require('../models/Leave');
const LeaveBalance      = require('../models/LeaveBalance');
const Timetable         = require('../models/Timetable');
const SubstituteRequest = require('../models/SubstituteRequest');
const User              = require('../models/User');

// ✅ FIXED: handles duplicate key error gracefully
async function getOrCreateBalance(teacherId, year) {
  const currentYear = year && !isNaN(year) ? year : new Date().getFullYear();

  try {
    // 1. Try to find existing balance first
    let balance = await LeaveBalance.findOne({ teacher: teacherId, year: currentYear });

    if (balance) return balance;

    // 2. Create new balance if not found
    balance = await Leave.create({
      teacher: teacherId,
      year:    currentYear,
      year
    });

    return balance;

  } catch (err) {
    // 3. If duplicate key error (race condition), fetch the existing one
    if (err.code === 11000) {
      return await LeaveBalance.findOne({ teacher: teacherId, year: currentYear });
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/leaves  — teacher applies leave
// ─────────────────────────────────────────────────────────────
exports.applyLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason, leaveType } = req.body;

    // Validate required fields
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'startDate, endDate and reason are required' });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }

    const year  = start.getFullYear();
    const month = start.getMonth() + 1;
    const diff = end.getTime() - start.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance
    const balance   = await getOrCreateBalance(req.user._id, year);
    const isFirst   = month <= 6;
    const remaining = isFirst
      ? balance.firstHalfTotal  - balance.firstHalfUsed
      : balance.secondHalfTotal - balance.secondHalfUsed;

    if (days > remaining) {
      return res.status(400).json({
        message: `Only ${remaining} leave(s) remaining for ${isFirst ? 'Jan–Jun' : 'Jul–Dec'}`
      });
    }

    // Create the Leave record
    const leave = await Leave.create({
      teacher:   req.user._id,
      startDate: start,
      endDate:   end,
      reason,
      leaveType: leaveType || 'Casual',
      days
    });

    // Find timetable for that day and create substitute requests
    const dayName   = start.toLocaleDateString('en-US', { weekday: 'long' });
    const timetable = await Timetable.findOne({
      teacher:   req.user._id,
      dayOfWeek: dayName,
    });

    if (timetable && timetable.periods.length > 0) {
      for (const period of timetable.periods) {
        // First: find teachers who teach the same class
        const sameClassTeachers = await User.find({
          _id:     { $ne: req.user._id },
          role:    'teacher',
          classes: period.className,
        });

        let requestedTo = sameClassTeachers.map(t => t._id);
        let status      = 'open';

        // If none found, fall back to all teachers
        if (requestedTo.length === 0) {
          const allTeachers = await User.find({
            _id:  { $ne: req.user._id },
            role: 'teacher',
          });
          requestedTo = allTeachers.map(t => t._id);
          status      = 'open_all';
        }

        const subReq = await SubstituteRequest.create({
          leave:         leave._id,
          absentTeacher: req.user._id,
          period: {
            periodNumber: period.periodNumber,
            startTime:    period.startTime,
            endTime:      period.endTime,
            subject:      period.subject,
            className:    period.className,
          },
          date: start,
          status,
          requestedTo,
        });

        leave.substituteRequests.push(subReq._id);
      }

      await leave.save();
    }

    res.status(201).json({ message: 'Leave applied successfully', leave });

  } catch (err) {
    console.error('applyLeave error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/leaves/my  — teacher sees their own leaves
// ─────────────────────────────────────────────────────────────
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ teacher: req.user._id })
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/leaves/balance  — teacher sees their leave balance
// ─────────────────────────────────────────────────────────────
exports.getLeaveBalance = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated properly' });
    }

    const year    = new Date().getFullYear();
    const balance = await getOrCreateBalance(req.user._id, year);

    res.json(balance);
  } catch (err) {
    console.error('BALANCE ERROR:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/leaves/all  — HOD and Principal see all leaves
// ─────────────────────────────────────────────────────────────
exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate('teacher', 'name email department')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/hod-approve
// ─────────────────────────────────────────────────────────────
exports.hodApprove = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    leave.hodApproval = true;
    leave.status      = 'hod_approved';
    await leave.save();

    res.json({ message: 'HOD approved', leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/principal-approve
// ─────────────────────────────────────────────────────────────
exports.principalApprove = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    if (!leave.hodApproval) {
      return res.status(400).json({ message: 'HOD must approve first' });
    }

    leave.principalApproval = true;
    leave.status            = 'principal_approved';

    // Deduct leave balance
    const month   = new Date(leave.startDate).getMonth() + 1;
    const year    = new Date(leave.startDate).getFullYear();
    const days    = Math.ceil(
      (new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)
    ) + 1;

    const balance = await getOrCreateBalance(leave.teacher, year);

    if (month <= 6) balance.firstHalfUsed  += days;
    else            balance.secondHalfUsed += days;

    await balance.save();
    await leave.save();

    res.json({ message: 'Principal approved, balance deducted', leave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/leaves/:id/reject
// ─────────────────────────────────────────────────────────────
exports.rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    leave.status = 'rejected';
    await leave.save();

    res.json({ message: 'Leave rejected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};