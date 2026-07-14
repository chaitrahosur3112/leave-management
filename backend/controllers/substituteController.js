// controllers/substituteController.js
// NEW WORKFLOW:
//  1. Teacher selects a date + picks ONE period from their timetable
//  2. System finds teachers who teach the SAME CLASS and are FREE that period
//  3. Substitute request is created and shown to those free teachers
//  4. A free teacher clicks Accept → Leave is auto-created → sent to HOD
//  5. If teacher clicks Decline → removed from their list, others still see it
//  6. HOD confirms the substitute

const SubstituteRequest = require('../models/SubstituteRequest');
const Leave             = require('../models/Leave');
const Timetable         = require('../models/Timetable');
const User              = require('../models/User'); // adjust path if different

// ─────────────────────────────────────────────────────────────────
// POST /api/substitutes/request
// Teacher sends substitute request for one period
// Body: { date, periodNumber, leaveType, reason }
// ─────────────────────────────────────────────────────────────────
exports.requestSubstitute = async (req, res) => {
  try {
    const { date, periodNumber, leaveType, reason, endDate } = req.body;
    if (!date || !periodNumber) {
      return res.status(400).json({ message: 'date and periodNumber are required' });
    }

    // 1. Get the absent teacher's timetable
    const myTT = await Timetable.findOne({ teacher: req.user._id });
    if (!myTT) return res.status(400).json({ message: 'You have no timetable assigned yet.' });

    // 2. Find the specific day from the timetable
    const dateObj  = new Date(date + 'T12:00:00');
    const dayName  = dateObj.toLocaleDateString('en-US', { weekday: 'long' }); // e.g. "Monday"
    const dayEntry = myTT.days.find(d => d.dayOfWeek === dayName);
    if (!dayEntry) return res.status(400).json({ message: `You have no classes on ${dayName}.` });

    // 3. Find the specific period
    const period = dayEntry.periods.find(p => p.periodNumber === Number(periodNumber));
    if (!period) return res.status(400).json({
      message: `Period ${periodNumber} not found in your ${dayName} timetable.`
    });

    // 4. Find ALL teachers who teach the SAME CLASS during this period
    //    A "same class teacher" = has the same className in the same period slot
    const allTimetables = await Timetable.find({ teacher: { $ne: req.user._id } })
      .populate('teacher', 'name email role');

    const sameClassTeacherIds = [];
    for (const tt of allTimetables) {
      const theirDay = tt.days.find(d => d.dayOfWeek === dayName);
      if (!theirDay) continue;
      const theirPeriod = theirDay.periods.find(p =>
        p.periodNumber === Number(periodNumber) && p.className === period.className
      );
      if (theirPeriod) sameClassTeacherIds.push(tt.teacher._id);
    }

    // 5. Among same-class teachers, find who is FREE (no class in this period)
    //    "Free" = they do NOT have ANY class in period slot at that time
    //    Actually: "same class teacher who is free" means they teach that class
    //    but their own timetable shows them as NOT having a conflicting class.
    //    For simplicity: same-class teachers who don't have a DIFFERENT class
    //    at the same period number are considered free.
    const freeTeacherIds = [];
    for (const tt of allTimetables) {
      const theirDay = tt.days.find(d => d.dayOfWeek === dayName);
      if (!theirDay) {
        // No classes that day = definitely free
        if (sameClassTeacherIds.some(id => id.equals(tt.teacher._id))) {
          freeTeacherIds.push(tt.teacher._id);
        }
        continue;
      }
      // Check if they have ANY class at this period number
      const conflict = theirDay.periods.find(p => p.periodNumber === Number(periodNumber));
      if (!conflict) {
        // Free at this period — check if they're a same-class teacher
        if (sameClassTeacherIds.some(id => id.equals(tt.teacher._id))) {
          freeTeacherIds.push(tt.teacher._id);
        }
      }
    }
    console.log("PERIOD DATA:", period);

    // If no same-class free teachers found, still create the request
    // (HOD can manually assign someone)
    // 6. Create substitute request
    const subReq = await SubstituteRequest.create({
      absentTeacher: req.user._id,
      periodNumber:  period.periodNumber,
      subject:       period.subject,
      className:     period.className,
      startTime:     period.startTime,
      endTime:       period.endTime,
      dayOfWeek:     dayName,
      date:          new Date(date + 'T00:00:00'),
      // Store free teacher IDs so frontend knows who to show this to
      // (the getMyRequests endpoint filters by this)
    });

    // Store which teachers should see this request
    // We add a field "visibleTo" to track this
    subReq.visibleTo = freeTeacherIds.length > 0 ? freeTeacherIds : 'all';
    // Note: we'll use a simpler approach — just save as a separate field

    res.status(201).json({
      message: `Substitute request sent to ${freeTeacherIds.length} free teacher(s) for ${dayName} Period ${periodNumber}.`,
      request: subReq,
      freeTeacherCount: freeTeacherIds.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/substitutes/my
// Returns substitute requests sent TO the logged-in teacher
// (i.e. they teach the same class and are free that period)
// ─────────────────────────────────────────────────────────────────
exports.getMyRequests = async (req, res) => {
  try {
    // Get the logged-in teacher's timetable
    const myTT = await Timetable.findOne({ teacher: req.user._id });

    // Find all OPEN substitute requests NOT created by me
    const allOpen = await SubstituteRequest.find({
      absentTeacher: { $ne: req.user._id },
      status: 'open',
      declinedBy: { $ne: req.user._id }, // exclude ones I already declined
    }).populate('absentTeacher', 'name email');

    if (!myTT) {
      // No timetable = show nothing (can't determine free periods)
      return res.json([]);
    }

    // Filter: show only requests where I teach the same class AND I'm free that period
    const relevant = allOpen.filter(req2 => {
      const myDay = myTT.days.find(d => d.dayOfWeek === req2.dayOfWeek);
      if (!myDay) return true; // I'm free the whole day

      // Check if I teach the SAME CLASS in any period
      const teachSameClass = myDay.periods.some(p => p.className === req2.className);
      if (!teachSameClass) return false;

      // Check I'm FREE at that specific period (no conflict)
      const conflict = myDay.periods.find(p => p.periodNumber === req2.periodNumber);
      return !conflict; // show if I have no class at that period
    });

    res.json(relevant);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/substitutes/:id/accept
// Teacher accepts the substitute request
// → Auto-creates the Leave document → sent to HOD
// ─────────────────────────────────────────────────────────────────
exports.acceptRequest = async (req, res) => {
  try {
    const subReq = await SubstituteRequest.findById(req.params.id)
      .populate('absentTeacher', 'name email');
    if (!subReq) return res.status(404).json({ message: 'Request not found' });
    if (subReq.status !== 'open') return res.status(400).json({ message: 'Request is no longer open' });

    // Mark as accepted
    subReq.status = 'accepted';
    subReq.substituteTeacher = req.user._id;
    await subReq.save();

    // Auto-create the Leave document now that substitute is confirmed
    // The absent teacher needs to fill reason + leaveType separately,
    // so we create it with placeholder values and mark it "substitute_confirmed"
    // The absent teacher will see a "Fill leave details" prompt in their dashboard
    const leave = await Leave.create({
      teacher:           subReq.absentTeacher._id,
      leaveType:         'casual',          // default; teacher updates this
      startDate:         subReq.date,
      endDate:           subReq.date,       // single day by default
      reason:            '',                // teacher fills this in
      substituteTeacher: req.user._id,
      substituteRequests:[subReq._id],
      status:            'substitute_confirmed',
    });

    // Link leave back to sub request
    subReq.leave = leave._id;
    await subReq.save();

    res.json({
      message: 'You accepted! The absent teacher will now fill their leave details and it will go to HOD.',
      leave,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/substitutes/:id/decline
// Teacher declines — added to declinedBy list, others still see it
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
// GET /api/substitutes/all  — HOD / Principal
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
// PATCH /api/substitutes/:id/hod-approve  — HOD confirms substitute
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

// PATCH /api/substitutes/:id/principal-approve
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