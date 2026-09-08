const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
function fixture() {
  const targets = Object.fromEntries(['Leave', 'SubstituteRequest', 'Timetable', 'LeaveBalance', 'User'].map(n => [n, {}]));
  const models = new Proxy(targets, { set(target, name, value) { Object.assign(target[name], value); return true; } });
  const mongoose = { startSession: async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }) };
  const original = Module._load;
  Module._load = function (name, parent, main) {
    if (name === 'mongoose') return mongoose;
    if (name.startsWith('../models/')) return models[name.slice(10)];
    return original.apply(this, arguments);
  };
  let W;
  try { delete require.cache[require.resolve('../services/leaveWorkflow')]; W = require('../services/leaveWorkflow'); }
  finally { Module._load = original; }
  return { W, models };
}
const query = value => ({ session: async () => value });
const leave = (status = 'coverage_pending') => ({ _id: 'leave1', teacher: 'absent', status, startDate: new Date('2026-09-10'), endDate: new Date('2026-09-11'), substituteRequests: ['r1', 'r2'], reason: 'Medical appointment' });
const request = (id, status = 'open') => ({ _id: id, leave: 'leave1', absentTeacher: 'absent', date: new Date('2026-09-10'), dayOfWeek: 'Thursday', periodNumber: 1, className: '10A', status, substituteTeacher: status === 'open' ? null : 'teacher1' });

test('strict date validation and inclusive ranges', () => {
  const { W } = fixture();
  assert.throws(() => W.date('2026-02-30'), /Invalid date/);
  assert.throws(() => W.date('2026-09-10T00:00:00'), /YYYY-MM-DD/);
  assert.throws(() => W.range('2026-09-11', '2026-09-10'), /precede/);
  const { start, end } = W.range('2026-09-10', '2026-09-11');
  assert.equal(W.days(start, end).length, 2);
});

test('coverage requires every linked period and an assigned teacher', async () => {
  const { W, models } = fixture();
  let rows = [request('r1', 'accepted')];
  models.SubstituteRequest = { find: () => query(rows) };
  assert.equal((await W.coverage(leave(), null)).complete, false);
  rows = [request('r1', 'accepted'), request('r2', 'open')];
  assert.equal((await W.coverage(leave(), null)).complete, false);
  rows[1].status = 'accepted'; rows[1].substituteTeacher = 'teacher2';
  assert.equal((await W.coverage(leave(), null)).complete, true);
  rows[1].substituteTeacher = null;
  assert.equal((await W.coverage(leave(), null)).complete, false);
});

test('only one atomic claim succeeds and incomplete coverage stays pending', async () => {
  const { W, models } = fixture();
  const l = leave(), r = request('r1'), rows = [r, request('r2')];
  models.SubstituteRequest = { findById: () => query(r), findOneAndUpdate: async () => { if (r.status !== 'open') return null; r.status = 'accepted'; r.substituteTeacher = 'teacher1'; return r; }, find: () => query(rows), exists: () => query(false) };
  models.Leave = { findById: () => query(l), exists: () => query(false), updateOne: async () => ({ modifiedCount: 1 }) };
  models.User = { findById: () => query({ role: 'teacher' }) };
  models.Timetable = { findOne: () => query({ days: [{ dayOfWeek: 'Thursday', periods: [{ className: '10A', periodNumber: 2 }] }] }) };
  assert.equal((await W.accept('r1', 'teacher1')).coverage.complete, false);
  assert.equal(l.status, 'coverage_pending');
  await assert.rejects(W.accept('r1', 'teacher2'), /no longer open/);
});

test('submission rejects incomplete coverage and changed dates', async () => {
  const { W, models } = fixture();
  const l = leave('substitute_confirmed'), rows = [request('r1', 'accepted'), request('r2')];
  models.Leave = { findOne: () => query(l), findOneAndUpdate: async () => ({ ...l, status: 'submitted' }) };
  models.SubstituteRequest = { find: () => query(rows) };
  await assert.rejects(W.submit('leave1', 'absent', { reason: 'Valid' }), /Not every/);
  rows[1].status = 'accepted'; rows[1].substituteTeacher = 'teacher2';
  await assert.rejects(W.submit('leave1', 'absent', { reason: 'Valid', endDate: '2026-09-12' }), /Date range/);
  assert.equal((await W.submit('leave1', 'absent', { reason: 'Valid' })).status, 'submitted');
});

test('HOD cannot approve an unsubmitted leave', async () => {
  const { W, models } = fixture();
  models.Leave = { findById: () => query(leave('substitute_confirmed')) };
  await assert.rejects(W.approve('leave1', 'hod'), /approval stage/);
});

test('Principal approval cannot repeat or bypass HOD', async () => {
  const { W, models } = fixture();
  models.Leave = { findById: () => query(leave('submitted')) };
  await assert.rejects(W.approve('leave1', 'principal'), /approval stage/);
  models.Leave.findById = () => query(leave('principal_approved'));
  await assert.rejects(W.approve('leave1', 'principal'), /approval stage/);
});

test('Principal posts balance once in the approval transaction', async () => {
  const { W, models } = fixture();
  const l = leave('hod_approved');
  let used = 0, posts = 0;
  models.Leave = { findById: () => query(l), findOneAndUpdate: async () => { l.status = 'principal_approved'; l.balancePostedAt = new Date(); return l; } };
  models.SubstituteRequest = { find: () => query([request('r1', 'accepted'), request('r2', 'accepted')]) };
  models.LeaveBalance = { findOneAndUpdate: async () => ({ _id: 'balance1', firstHalfTotal: 7, firstHalfUsed: used, secondHalfTotal: 8, secondHalfUsed: 0 }), updateOne: async (filter, update) => { used += update.$inc.secondHalfUsed || update.$inc.firstHalfUsed || 0; posts++; return { modifiedCount: 1 }; } };
  await W.approve('leave1', 'principal');
  assert.equal(used, 2); assert.equal(posts, 1);
  await assert.rejects(W.approve('leave1', 'principal'), /approval stage/);
  assert.equal(used, 2);
});

test('rejection requires a reason and the correct review stage', async () => {
  const { W, models } = fixture();
  models.Leave = { findById: () => query(leave('submitted')) };
  await assert.rejects(W.reject('leave1', { _id: 'hod', role: 'hod' }, ''), /reason/);
  await assert.rejects(W.reject('leave1', { _id: 'principal', role: 'principal' }, 'No'), /review stage/);
});
