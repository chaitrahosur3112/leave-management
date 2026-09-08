const SubstituteRequest = require('../models/SubstituteRequest');
const Leave = require('../models/Leave');
const Timetable = require('../models/Timetable');
const W = require('../services/leaveWorkflow');
const send = (res, e) => res.status(e.status || (e.code === 11000 ? 409 : 500)).json({ message: e.code === 11000 ? 'A conflicting request or assignment already exists.' : e.message });

exports.requestSubstitute = async (req, res) => {
  try { res.status(201).json(await W.createCoverage(req.user._id, req.body)); }
  catch (e) { send(res, e); }
};
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await SubstituteRequest.find({ absentTeacher: { $ne: req.user._id }, status: 'open', declinedBy: { $ne: req.user._id } }).populate('absentTeacher', 'name email').populate('leave', 'startDate endDate leaveType status');
    const relevant = [];
    for (const request of requests) {
      if (request.leave && await W.eligible(req.user._id, request, null)) relevant.push(request);
    }
    res.json(relevant);
  } catch (e) { send(res, e); }
};
exports.acceptRequest = async (req, res) => {
  try { res.json({ message: 'Substitute accepted.', ...await W.accept(req.params.id, req.user._id) }); }
  catch (e) { send(res, e); }
};
exports.declineRequest = async (req, res) => {
  try {
    const request = await SubstituteRequest.findOneAndUpdate({ _id: req.params.id, status: 'open', absentTeacher: { $ne: req.user._id } }, { $addToSet: { declinedBy: req.user._id } }, { new: true });
    if (!request) return res.status(409).json({ message: 'Request is no longer open.' });
    res.json({ message: 'Declined.', request });
  } catch (e) { send(res, e); }
};
exports.getAllSubRequests = async (req, res) => {
  try { res.json(await SubstituteRequest.find().populate('absentTeacher substituteTeacher', 'name email').populate('leave', 'startDate endDate leaveType status').sort({ createdAt: -1 })); }
  catch (e) { send(res, e); }
};
async function approveAssignment(req, res, from, to) {
  try {
    const result = await W.transaction(async session => {
      const request = await SubstituteRequest.findById(req.params.id).session(session);
      if (!request) W.fail('Request not found.', 404);
      if (request.status !== from || !request.substituteTeacher) W.fail('Assignment is not at this approval stage.', 409);
      const leave = await Leave.findById(request.leave).session(session);
      if (!leave || (to === 'hod_approved' ? !['submitted', 'hod_approved'].includes(leave.status) : leave.status !== 'principal_approved')) W.fail('Leave has not reached this approval stage.', 409);
      return SubstituteRequest.findOneAndUpdate({ _id: request._id, status: from }, { $set: { status: to } }, { new: true, session });
    });
    res.json({ message: 'Assignment approved.', subReq: result });
  } catch (e) { send(res, e); }
}
exports.hodApproveSubstitute = (req, res) => approveAssignment(req, res, 'accepted', 'hod_approved');
exports.principalApproveSubstitute = (req, res) => approveAssignment(req, res, 'hod_approved', 'principal_approved');
