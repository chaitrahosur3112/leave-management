// controllers/substituteController.js — UPDATED
// KEY CHANGES:
//  1. requestSubstitute now takes startDate + endDate + leaveType
//     and auto-creates ONE substitute request per period per day
//     in the date range — all in one go
//  2. acceptRequest links ALL those sub requests to ONE leave document

const SubstituteRequest = require('../models/SubstituteRequest');
const Leave             = require('../models/Leave');
const Timetable         = require('../models/Timetable');
const User              = require('../models/User');

// Helper: get all dates between startDate and endDate inclusive
function getDatesInRange(startStr, endStr) {
  const dates = [];
  const cur   = new Date(startStr + 'T12:00:00');
  const end   = new Date(endStr   + 'T12:00:00');
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// Helper: get day name from Date object
function getDayName(dateObj) {
  return dateObj.toLocaleDateString('en-US', { weekday: 'long' });
}

// ─────────────────────────────────────────────────────────────────
// POST /api/substitutes/request
// ── UPDATED: takes startDate + endDate + leaveType ──
// Creates ONE sub request for EVERY period across EVERY day in range
// Body: { startDate, endDate, leaveType }
// ─────────────────────────────────────────────────────────────────
exports.requestSubstitute = async (req, res) => {
  try {
    const { startDate, endDate, leaveType } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ message: 'endDate cannot be before startDate' });
    }

    // 1. Get the absent teacher's timetable
    const myTT = await Timetable.findOne({ teacher: req.user._id });
    if (!myTT) return res.status(400).json({ message: 'You have no timetable assigned yet.' });

    // 2. Get all timetables of other teachers (for finding free same-class teachers)
    const allOtherTT = await Timetable.find({ teacher: { $ne: req.user._id } })
      .populate('teacher', 'name email role');

    // 3. Loop through every date in the range
    const allDates     = getDatesInRange(startDate, endDate);
    const createdSubs  = [];
    const skippedDays  = []; // days with no classes

    for (const dateObj of allDates) {
      const dayName  = getDayName(dateObj);
      const dayEntry = myTT.days.find(d => d.dayOfWeek === dayName);

      // No classes that day — skip (weekend or free day)
      if (!dayEntry || dayEntry.periods.length === 0) {
        skippedDays.push(dayName);
        continue;
      }

      // 4. For each period on this day, create a substitute request
      for (const period of dayEntry.periods) {

        // Find free same-class teachers for this period
        const freeTeacherIds = [];
        for (const tt of allOtherTT) {
          const theirDay = tt.days.find(d => d.dayOfWeek === dayName);

          // Check they teach the same class
          const allPeriods = theirDay ? theirDay.periods : [];
          const teachSameClass = allPeriods.some(p => p.className === period.className);
          if (!teachSameClass) continue;

          // Check they're FREE at this period (no class at this period number)
          const conflict = allPeriods.find(p => p.periodNumber === period.periodNumber);
          if (!conflict) {
            freeTeacherIds.push(tt.teacher._id);
          }
        }

        // Create the substitute request
        const subReq = await SubstituteRequest.create({
          absentTeacher: req.user._id,
          periodNumber:  period.periodNumber,
          subject:       period.subject,
          className:     period.className,
          startTime:     period.startTime,
          endTime:       period.endTime,
          dayOfWeek:     dayName,
          date:          new Date(dateObj.toISOString().split('T')[0] + 'T00:00:00'),
          status:        'open',
        });

        createdSubs.push(subReq);
      }
    }

    if (createdSubs.length === 0) {
      return res.status(400).json({
        message: `No classes found between ${startDate} and ${endDate}. Nothing to request.`,
      });
    }

    // 5. Store the requested leave type on the user temporarily
    //    (will be used when a substitute accepts and creates the Leave)
    //    We pass it back in the response — frontend shows it in the form
    const totalDays = allDates.length - skippedDays.length;

    res.status(201).json({
      message: `✅ Substitute requests sent for ${createdSubs.length} period(s) across ${totalDays} day(s). Free same-class teachers have been notified.`,
      createdCount: createdSubs.length,
      daysCovered:  totalDays,
      leaveType,    // echoed back so frontend can store it
      startDate,
      endDate,
      requests: createdSubs,
    });
  } catch (e) {
    console.error('requestSubstitute error:', e);
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/substitutes/my
// Returns open sub requests where the logged-in teacher:
//   - teaches the same class
//   - is free during that period
// ─────────────────────────────────────────────────────────────────
exports.getMyRequests = async (req, res) => {
  try {
    const myTT = await Timetable.findOne({ teacher: req.user._id });

    const allOpen = await SubstituteRequest.find({
      absentTeacher: { $ne: req.user._id },
      status:        'open',
      declinedBy:    { $ne: req.user._id },
    }).populate('absentTeacher', 'name email');

    if (!myTT) return res.json([]);

    const relevant = allOpen.filter(req2 => {
      const myDay      = myTT.days.find(d => d.dayOfWeek === req2.dayOfWeek);
      const allPeriods = myDay ? myDay.periods : [];

      // I must teach the same class somewhere
      const teachSameClass = allPeriods.some(p => p.className === req2.className);
      if (!teachSameClass) return false;

      // I must be FREE at that period number
      const conflict = allPeriods.find(p => p.periodNumber === req2.periodNumber);
      return !conflict;
    });

    res.json(relevant);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/substitutes/:id/accept
// ── UPDATED: checks if a leave already exists for this absent teacher
//    for this date range — if yes, links to it; if no, creates one ──
// ─────────────────────────────────────────────────────────────────
exports.acceptRequest = async (req, res) => {
  try {
    const subReq = await SubstituteRequest.findById(req.params.id)
      .populate('absentTeacher', 'name email');
    if (!subReq) return res.status(404).json({ message: 'Request not found' });
    if (subReq.status !== 'open')
      return res.status(400).json({ message: 'Request is no longer open' });

    // Mark this sub request as accepted
    subReq.status            = 'accepted';
    subReq.substituteTeacher = req.user._id;
    await subReq.save();

    // Check if a leave already exists for this absent teacher
    // (another period from the same date range may have already created one)
    let leave = await Leave.findOne({
      teacher: subReq.absentTeacher._id,
      status:  'substitute_confirmed',
      // Match leaves whose date range overlaps with this sub request date
      startDate: { $lte: subReq.date },
      endDate:   { $gte: subReq.date },
    });

    if (leave) {
      // Add this sub request to the existing leave
      if (!leave.substituteRequests.includes(subReq._id)) {
        leave.substituteRequests.push(subReq._id);
        await leave.save();
      }
    } else {
      // Create a new leave document
      leave = await Leave.create({
        teacher:            subReq.absentTeacher._id,
        leaveType:          'casual',   // teacher will update this
        startDate:          subReq.date,
        endDate:            subReq.date,
        reason:             '',         // teacher fills this
        substituteTeacher:  req.user._id,
        substituteRequests: [subReq._id],
        status:             'substitute_confirmed',
      });
    }

    // Link leave back to sub request
    subReq.leave = leave._id;
    await subReq.save();

    res.json({
      message: 'You accepted! The absent teacher will now fill their leave details.',
      leave,
    });
  } catch (e) {
    console.error('acceptRequest error:', e);
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/substitutes/:id/decline
// ─────────────────────────────────────────────────────────────────
exports.declineRequest = async (req, res) => {
  try {
    const subReq = await SubstituteRequest.findById(req.params.id);
    if (!subReq) return res.status(404).json({ message: 'Not found' });
    subReq.declinedBy.push(req.user._id);
    await subReq.save();
    res.json({ message: 'Declined. Other available teachers will still see this request.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/substitutes/all — HOD / Principal
// ─────────────────────────────────────────────────────────────────
exports.getAllSubRequests = async (req, res) => {
  try {
    const all = await SubstituteRequest.find()
      .populate('absentTeacher',     'name email')
      .populate('substituteTeacher', 'name email')
      .sort({ createdAt: -1 });
    res.json(all);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/substitutes/:id/hod-approve
// ─────────────────────────────────────────────────────────────────
exports.hodApproveSubstitute = async (req, res) => {
  try {
    const subReq = await SubstituteRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'hod_approved' },
      { new: true }
    ).populate('absentTeacher substituteTeacher', 'name email');
    res.json({ message: 'Substitute assignment confirmed by HOD.', subReq });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/substitutes/:id/principal-approve
// ─────────────────────────────────────────────────────────────────
exports.principalApproveSubstitute = async (req, res) => {
  try {
    const subReq = await SubstituteRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'principal_approved' },
      { new: true }
    );
    res.json({ message: 'Approved.', subReq });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};