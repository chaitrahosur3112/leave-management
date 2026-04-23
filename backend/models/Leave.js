// models/Leave.js
// =====================================================
// Schema for leave applications
// =====================================================

const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId, // References a Teacher document
      ref: "Teacher",                        // "ref" enables .populate() to fetch teacher details
      required: true,
    },
    leaveType: {
      type: String,
      enum: ["casual", "sick", "emergency","paternity/maternity"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      // The approval flow: pending → hod_approved → approved
      // Or at any point: rejected
      enum: ["pending", "hod_approved", "approved", "rejected"],
      default: "pending",
    },
    hodRemark: { type: String, default: "" },
    principalRemark: { type: String, default: "" },
    // Track which admin took action
    hodApprovedBy:       { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    principalApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", LeaveSchema);