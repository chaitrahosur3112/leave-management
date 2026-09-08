// models/User.js — FIXED
// Added privilegedLeaves field (unused leaves carried over from previous year)
// Everything else kept exactly as your original

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['teacher','hod','principal'], default: 'teacher' },
  department: { type: String, default: 'General' },
  subjects:   [{ type: String }],
  classes:    [{ type: String }],

  // These fields are kept for backward compat but
  // actual balance is stored in LeaveBalance model
  firstHalfTotal:  { type: Number, default: 7 },
  firstHalfUsed:   { type: Number, default: 0 },
  secondHalfTotal: { type: Number, default: 8 },
  secondHalfUsed:  { type: Number, default: 0 },

  // NEW: Privileged leaves = unused leaves carried over from previous year
  // Shown as a separate card on the dashboard
  privilegedLeaves: { type: Number, default: 0 },

}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);