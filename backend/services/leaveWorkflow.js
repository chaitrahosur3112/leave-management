const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const SubstituteRequest = require('../models/SubstituteRequest');
const Timetable = require('../models/Timetable');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const TYPES = ['casual', 'sick', 'emergency', 'paternity/maternity'];
const ACTIVE = ['coverage_pending', 'substitute_confirmed', 'submitted', 'hod_approved', 'principal_approved'];
const CONFIRMED = ['accepted', 'hod_approved', 'principal_approved'];
const DAY = 86400000;
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Use YYYY-MM-DD dates.');
  const d = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) fail('Invalid date.');
  return d;
}
function range(start, end) {
  const a = date(start), b = date(end);
  if (b < a) fail('End date cannot precede start date.');
  if ((b - a) / DAY > 365) fail('Date range is too long.');
  return { start: a, end: b };
}
function days(a, b) { const result = []; for (let t = a.getTime(); t <= b.getTime(); t += DAY) result.push(new Date(t)); return result; }
function dayName(d) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]; }
function id(v) { return String(v?._id || v); }
function same(a, b) { return id(a) === id(b); }
function key(d, p) { return `${new Date(d).toISOString().slice(0, 10)}:${p}`; }
function confirmed(s) { return CONFIRMED.includes(s); }
async function transaction(work) {
  const session = await mongoose.startSession();
  try { let result; await session.withTransaction(async () => { result = await work(session); }); return result; }
  finally { await session.endSession(); }
}
async function lock(session, teachers) {
  for (const teacher of [...new Set(teachers.map(id))].sort()) {
    const result = await User.updateOne({ _id: teacher }, { $inc: { workflowRevision: 1 } }, { session });
    if (!result.matchedCount) fail('Teacher not found.', 404);
  }
}
async function coverage(leave, session) {
  const requests = await SubstituteRequest.find({ leave: leave._id }).session(session);
  const expected = leave.substituteRequests.map(id);
  const actual = new Set(requests.map(r => id(r._id)));
  const complete = expected.length > 0 && actual.size === expected.length && expected.every(x => actual.has(x)) && requests.every(r => confirmed(r.status) && r.substituteTeacher);
  return { complete, required: expected.length, accepted: requests.filter(r => confirmed(r.status) && r.substituteTeacher).length, requests };
}
async function eligible(teacher, request, session) {
  if (same(teacher, request.absentTeacher)) return false;
  const user = await User.findById(teacher).session(session);
  if (!user || !['teacher', 'hod', 'principal'].includes(user.role)) return false;
  const tt = await Timetable.findOne({ teacher }).session(session);
  const periods = tt?.days.find(d => d.dayOfWeek === request.dayOfWeek)?.periods || [];
  if (!periods.some(p => p.className === request.className)) return false;
  if (periods.some(p => p.periodNumber === request.periodNumber)) return false;
  if (await SubstituteRequest.exists({ substituteTeacher: teacher, date: request.date, periodNumber: request.periodNumber, status: { $in: CONFIRMED } }).session(session)) return false;
  if (await Leave.exists({ teacher, startDate: { $lte: request.date }, endDate: { $gte: request.date }, status: { $in: ['submitted', 'hod_approved', 'principal_approved'] } }).session(session)) return false;
  return true;
}
async function createCoverage(teacher, body) {
  const { start, end } = range(body.startDate, body.endDate);
  if (!TYPES.includes(body.leaveType)) fail('Invalid leave type.');
  return transaction(async session => {
    await lock(session, [teacher]);
    const existing = await Leave.findOne({ teacher, status: { $in: ACTIVE }, startDate: { $lte: end }, endDate: { $gte: start } }).session(session);
    if (existing) {
      if (existing.startDate.getTime() === start.getTime() && existing.endDate.getTime() === end.getTime() && existing.leaveType === body.leaveType) {
        const state = await coverage(existing, session);
        return { leave: existing, requests: state.requests, createdCount: 0, message: 'This leave application already exists. No duplicate coverage requests were created.' };
      }
      fail('An active leave already overlaps this date range.', 409);
    }
    const tt = await Timetable.findOne({ teacher }).session(session);
    if (!tt) fail('You have no timetable assigned.');
    const periods = days(start, end).flatMap(d => (tt.days.find(x => x.dayOfWeek === dayName(d))?.periods || []).map(p => ({ date: d, dayOfWeek: dayName(d), periodNumber: p.periodNumber, subject: p.subject, className: p.className, startTime: p.startTime, endTime: p.endTime, absentTeacher: teacher, status: 'open' })));
    if (!periods.length) fail('No scheduled periods in this date range.');
    if (new Set(periods.map(p => key(p.date, p.periodNumber))).size !== periods.length) fail('Timetable contains duplicate period numbers.');
    const [leave] = await Leave.create([{ teacher, startDate: start, endDate: end, leaveType: body.leaveType, status: 'coverage_pending' }], { session });
    const requests = await SubstituteRequest.create(periods.map(p => ({ ...p, leave: leave._id })), { session });
    leave.substituteRequests = requests.map(r => r._id);
    await leave.save({ session });
    return { leave, requests, createdCount: requests.length, message: `${requests.length} period(s) requested. Leave submission unlocks after every period is accepted.` };
  });
}
async function accept(requestId, teacher) {
  return transaction(async session => {
    const request = await SubstituteRequest.findById(requestId).session(session);
    if (!request) fail('Request not found.', 404);
    if (request.status !== 'open') fail('Request is no longer open.', 409);
    await lock(session, [teacher, request.absentTeacher]);
    if (!await eligible(teacher, request, session)) fail('You are not available or eligible for this period.', 409);
    const leave = await Leave.findById(request.leave).session(session);
    if (!leave || !['coverage_pending', 'substitute_confirmed'].includes(leave.status)) fail('Leave is not accepting substitutes.', 409);
    const claimed = await SubstituteRequest.findOneAndUpdate({ _id: requestId, status: 'open' }, { $set: { status: 'accepted', substituteTeacher: teacher } }, { new: true, session });
    if (!claimed) fail('Another teacher already accepted this period.', 409);
    const state = await coverage(leave, session);
    if (state.complete) await Leave.updateOne({ _id: leave._id, status: 'coverage_pending' }, { $set: { status: 'substitute_confirmed', coverageCompletedAt: new Date() } }, { session });
    return { request: claimed, coverage: state };
  });
}
async function submit(leaveId, teacher, body) {
  return transaction(async session => {
    await lock(session, [teacher]);
    const leave = await Leave.findOne({ _id: leaveId, teacher }).session(session);
    if (!leave) fail('Leave not found.', 404);
    if (leave.status !== 'substitute_confirmed') fail('All coverage must be confirmed before submission.', 409);
    if (!(await coverage(leave, session)).complete) fail('Not every required period has an accepted substitute.', 409);
    if (typeof body.reason !== 'string' || !body.reason.trim()) fail('Reason is required.');
    if (body.leaveType && body.leaveType !== leave.leaveType) fail('Leave type cannot change after coverage is requested.');
    if (body.startDate && date(body.startDate).getTime() !== leave.startDate.getTime()) fail('Date range cannot change after coverage is requested.');
    if (body.endDate && date(body.endDate).getTime() !== leave.endDate.getTime()) fail('Date range cannot change after coverage is requested.');
    const updated = await Leave.findOneAndUpdate({ _id: leaveId, teacher, status: 'substitute_confirmed' }, { $set: { reason: body.reason.trim(), status: 'submitted', submittedAt: new Date() } }, { new: true, session });
    if (!updated) fail('Leave was already submitted.', 409);
    return updated;
  });
}
async function approve(leaveId, role) {
  return transaction(async session => {
    const leave = await Leave.findById(leaveId).session(session);
    if (!leave) fail('Leave not found.', 404);
    const expected = role === 'hod' ? 'submitted' : 'hod_approved';
    if (leave.status !== expected) fail('Leave is not at this approval stage.', 409);
    if (!(await coverage(leave, session)).complete) fail('Coverage is incomplete.', 409);
    if (!leave.reason?.trim()) fail('Leave has not been submitted.', 409);
    const now = new Date();
    if (role === 'hod') {
      const updated = await Leave.findOneAndUpdate({ _id: leaveId, status: expected }, { $set: { status: 'hod_approved', hodApprovedAt: now } }, { new: true, session });
      if (!updated) fail('Approval state changed.', 409);
      return updated;
    }
    if (leave.balancePostedAt) fail('Balance has already been posted.', 409);
    const charges = new Map();
    for (const d of days(leave.startDate, leave.endDate)) {
      const year = d.getUTCFullYear(), half = d.getUTCMonth() < 6 ? 'firstHalfUsed' : 'secondHalfUsed';
      const k = `${year}:${half}`;
      charges.set(k, (charges.get(k) || 0) + 1);
    }
    for (const [k, count] of charges) {
      const [year, field] = k.split(':');
      const balance = await LeaveBalance.findOneAndUpdate({ teacher: leave.teacher, year: Number(year) }, { $setOnInsert: { teacher: leave.teacher, year: Number(year) } }, { upsert: true, new: true, session });
      const total = field === 'firstHalfUsed' ? balance.firstHalfTotal : balance.secondHalfTotal;
      const used = balance[field];
      if (used + count > total) fail('Insufficient leave balance.', 409);
      const updated = await LeaveBalance.updateOne({ _id: balance._id, [field]: used }, { $inc: { [field]: count } }, { session });
      if (!updated.modifiedCount) fail('Leave balance changed. Please retry.', 409);
    }
    const updated = await Leave.findOneAndUpdate({ _id: leaveId, status: expected, balancePostedAt: null }, { $set: { status: 'principal_approved', principalApprovedAt: now, balancePostedAt: now } }, { new: true, session });
    if (!updated) fail('Approval state changed.', 409);
    return updated;
  });
}
async function reject(leaveId, actor, reason) {
  return transaction(async session => {
    const leave = await Leave.findById(leaveId).session(session);
    if (!leave) fail('Leave not found.', 404);
    const allowed = actor.role === 'hod' ? ['submitted'] : ['hod_approved'];
    if (!allowed.includes(leave.status)) fail('Leave is not at your review stage.', 409);
    if (typeof reason !== 'string' || !reason.trim()) fail('Rejection reason is required.');
    const updated = await Leave.findOneAndUpdate({ _id: leaveId, status: leave.status }, { $set: { status: 'rejected', rejectedAt: new Date(), rejectedBy: actor._id, rejectionReason: reason.trim() } }, { new: true, session });
    if (!updated) fail('Review state changed.', 409);
    return updated;
  });
}
module.exports = { TYPES, ACTIVE, CONFIRMED, fail, date, range, days, dayName, id, same, key, confirmed, transaction, lock, coverage, eligible, createCoverage, accept, submit, approve, reject };
