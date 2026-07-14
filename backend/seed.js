// seedTimetable.js
// Run once: node seedTimetable.js
// Creates sample timetables for your 3 existing teachers
// Adjust emails to match your actual teacher accounts

require('dotenv').config();
const mongoose  = require('mongoose');
const Timetable = require('./models/Timetable');
const User      = require('./models/User'); // adjust path if needed

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find teachers by email — UPDATE THESE TO MATCH YOUR ACTUAL TEACHER EMAILS
  const ravi      = await User.findOne({ email: 'ravi@school.com' });
  const priya     = await User.findOne({ email: 'priya@school.com' });
  const mohan     = await User.findOne({ email: 'mohan@school.com' }); // add more teachers if needed

  if (!ravi)  console.warn('⚠ ravi@school.com not found — skip');
  if (!priya) console.warn('⚠ priya@school.com not found — skip');

  // Clear old timetables
  await Timetable.deleteMany({});
  console.log('Cleared old timetables');

  const timetables = [];

  // ── RAVI's timetable ───────────────────────────────────────────
  if (ravi) {
    timetables.push({
      teacher: ravi._id,
      days: [
        {
          dayOfWeek: 'Monday',
          periods: [
            { periodNumber:1, subject:'Physics', className:'10A', startTime:'09:00', endTime:'09:45' },
            { periodNumber:3, subject:'Physics', className:'11B', startTime:'11:00', endTime:'11:45' },
          ],
        },
        {
          dayOfWeek: 'Tuesday',
          periods: [
            { periodNumber:2, subject:'Physics', className:'10A', startTime:'09:50', endTime:'10:35' },
            { periodNumber:4, subject:'Physics', className:'10B', startTime:'11:50', endTime:'12:35' },
          ],
        },
        {
          dayOfWeek: 'Wednesday',
          periods: [
            { periodNumber:1, subject:'Physics', className:'10A', startTime:'09:00', endTime:'09:45' },
            { periodNumber:5, subject:'Physics', className:'11A', startTime:'13:00', endTime:'13:45' },
          ],
        },
        {
          dayOfWeek: 'Thursday',
          periods: [
            { periodNumber:3, subject:'Physics', className:'10B', startTime:'11:00', endTime:'11:45' },
          ],
        },
        {
          dayOfWeek: 'Friday',
          periods: [
            { periodNumber:2, subject:'Physics', className:'11B', startTime:'09:50', endTime:'10:35' },
            { periodNumber:4, subject:'Physics', className:'10A', startTime:'11:50', endTime:'12:35' },
          ],
        },
      ],
    });
  }

  // ── PRIYA's timetable ──────────────────────────────────────────
  // Note: Priya teaches some of the SAME CLASSES as Ravi
  // So when Ravi is absent, Priya will see his substitute requests
  if (priya) {
    timetables.push({
      teacher: priya._id,
      days: [
        {
          dayOfWeek: 'Monday',
          periods: [
            { periodNumber:2, subject:'Chemistry', className:'10A', startTime:'09:50', endTime:'10:35' },
            // Period 1 is FREE → Priya can cover Ravi's Period 1 (same class 10A)
          ],
        },
        {
          dayOfWeek: 'Tuesday',
          periods: [
            { periodNumber:1, subject:'Chemistry', className:'11B', startTime:'09:00', endTime:'09:45' },
            { periodNumber:3, subject:'Chemistry', className:'10A', startTime:'11:00', endTime:'11:45' },
            // Period 2 is FREE → Priya can cover Ravi's Period 2 (same class 10A)
          ],
        },
        {
          dayOfWeek: 'Wednesday',
          periods: [
            { periodNumber:3, subject:'Chemistry', className:'10A', startTime:'11:00', endTime:'11:45' },
            // Period 1 is FREE → can cover Ravi's Period 1 (class 10A)
          ],
        },
        {
          dayOfWeek: 'Thursday',
          periods: [
            { periodNumber:1, subject:'Chemistry', className:'11A', startTime:'09:00', endTime:'09:45' },
            { periodNumber:2, subject:'Chemistry', className:'10B', startTime:'09:50', endTime:'10:35' },
          ],
        },
        {
          dayOfWeek: 'Friday',
          periods: [
            { periodNumber:1, subject:'Chemistry', className:'10A', startTime:'09:00', endTime:'09:45' },
            // Period 2 is FREE → can cover Ravi's Period 2 (class 10A)
          ],
        },
      ],
    });
  }

  // ── MOHAN's timetable (if exists) ─────────────────────────────
  if (mohan) {
    timetables.push({
      teacher: mohan._id,
      days: [
        {
          dayOfWeek: 'Monday',
          periods: [
            { periodNumber:4, subject:'Maths', className:'10A', startTime:'11:50', endTime:'12:35' },
            // Periods 1,2,3 FREE → can cover same-class requests
          ],
        },
        {
          dayOfWeek: 'Tuesday',
          periods: [
            { periodNumber:5, subject:'Maths', className:'10B', startTime:'13:00', endTime:'13:45' },
          ],
        },
        {
          dayOfWeek: 'Wednesday',
          periods: [
            { periodNumber:2, subject:'Maths', className:'10A', startTime:'09:50', endTime:'10:35' },
            { periodNumber:4, subject:'Maths', className:'11A', startTime:'11:50', endTime:'12:35' },
          ],
        },
        {
          dayOfWeek: 'Thursday',
          periods: [
            { periodNumber:2, subject:'Maths', className:'10A', startTime:'09:50', endTime:'10:35' },
          ],
        },
        {
          dayOfWeek: 'Friday',
          periods: [
            { periodNumber:3, subject:'Maths', className:'10B', startTime:'11:00', endTime:'11:45' },
          ],
        },
      ],
    });
  }

  await Timetable.insertMany(timetables);
  console.log(`✅ Created ${timetables.length} timetable(s)`);
  console.log('');
  console.log('How substitution works with this data:');
  console.log('  Ravi absent Monday Period 1 (class 10A)');
  console.log('  → Priya teaches 10A but is FREE on Monday Period 1 → she sees the request');
  console.log('  → Mohan teaches 10A but is FREE on Monday Period 1 → he also sees it');
  console.log('  → Whoever accepts first, leave is created for Ravi');

  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });