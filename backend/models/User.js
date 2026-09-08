const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'hod', 'principal'], default: 'teacher' },
  department: { type: String, default: 'General' },
  subjects: [{ type: String }],
  classes: [{ type: String }],
  firstHalfTotal: { type: Number, default: 7 },
  firstHalfUsed: { type: Number, default: 0 },
  secondHalfTotal: { type: Number, default: 8 },
  secondHalfUsed: { type: Number, default: 0 },
  privilegedLeaves: { type: Number, default: 0 },
  workflowRevision: { type: Number, default: 0, select: false },
}, { timestamps: true });
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});
userSchema.methods.matchPassword = async function (enteredPassword) { return bcrypt.compare(enteredPassword, this.password); };
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
