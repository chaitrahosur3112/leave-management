const Leave = require('../models/Leave');
const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');
const W = require('../services/leaveWorkflow');
const send = (res, e) => res.status(e.status || (e.code === 11000 ? 409 : 500)).json({ message: e.code === 11000 ? 'A conflicting update occurred. Please retry.' : e.message });
exports.getMyLeaves = async (req, res) => {
  try { res.json(await Leave.find({ teacher: req.user._id }).populate('substituteTeacher', 'name email').populate('substituteRequests').sort({ createdAt: -1 })); }
  catch (e) { send(res, e); }
};
exports.getLeaveBalance = async (req, res) => {
  try {
    const year = new Date().getUTCFullYear();
    let bal = await LeaveBalance.findOne({ teacher: req.user._id, year });
    if (!bal) bal = await LeaveBalance.findOneAndUpdate({ teacher: req.user._id, year }, { $setOnInsert: { teacher: req.user._id, year } }, { upsert: true, new: true });
    const user = await User.findById(req.user._id);
    res.json({ firstHalfTotal: bal.firstHalfTotal, firstHalfUsed: bal.firstHalfUsed, secondHalfTotal: bal.secondHalfTotal, secondHalfUsed: bal.secondHalfUsed, privilegedLeaves: user?.privilegedLeaves || 0 });
  } catch (e) { send(res, e); }
};
exports.fillLeaveDetails = async (req, res) => {
  try { res.json({ message: 'Leave submitted for HOD review.', leave: await W.submit(req.params.id, req.user._id, req.body) }); }
  catch (e) { send(res, e); }
};
exports.getAllLeaves = async (req, res) => {
  try { res.json(await Leave.find().populate('teacher substituteTeacher', 'name email').populate('substituteRequests').sort({ createdAt: -1 })); }
  catch (e) { send(res, e); }
};
exports.hodApprove = async (req, res) => {
  try { res.json({ message: 'HOD approved. Sent to Principal.', leave: await W.approve(req.params.id, 'hod') }); }
  catch (e) { send(res, e); }
};
exports.principalApprove = async (req, res) => {
  try { res.json({ message: 'Leave approved and balance posted.', leave: await W.approve(req.params.id, 'principal') }); }
  catch (e) { send(res, e); }
};
exports.rejectLeave = async (req, res) => {
  try { res.json({ message: 'Leave rejected.', leave: await W.reject(req.params.id, req.user, req.body.reason) }); }
  catch (e) { send(res, e); }
};
exports.applyLeave = async (req, res) => res.status(400).json({ message: 'Request substitute coverage first, then submit the linked leave.' });
