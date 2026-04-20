require('dotenv').config();
const mongoose  = require('mongoose');
const User      = require('./models/User');
const Timetable = require('./models/Timetable');
const LeaveBalance = require('./models/LeaveBalance');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding...');

  // Clear old data
  await User.deleteMany({});
  await Timetable.deleteMany({});
  await LeaveBalance.deleteMany({});

  // Create users (password is hashed by the model's pre-save hook)
  const principal = await User.create({
    name: 'Mr. Principal', email: 'principal@school.com',
    password: '123456', role: 'principal', department: 'Admin'
  });

  const hod = await User.create({
    name: 'Dr. Priya HOD', email: 'hod@school.com',
    password: '123456', role: 'hod', department: 'Science'
  });

  const teacher1 = await User.create({
    name: 'Dr. Ravi Kumar', email: 'ravi@school.com',
    password: '123456', role: 'teacher', department: 'Science',
    subjects: ['Physics'], classes: ['10A', '10B', '11A']
  });

  const teacher2 = await User.create({
    name: 'Ms. Priya G', email: 'priya@school.com',
    password: '123456', role: 'teacher', department: 'Science',
    subjects: ['Chemistry'], classes: ['10A', '11A']
  });

  const teacher3 = await User.create({
    name: 'Mr. Mohan Kumar', email: 'mohan@school.com',
    password: '123456', role: 'teacher', department: 'Maths',
    subjects: ['Maths'], classes: ['10B', '11B']
  });

  const teacher4 = await User.create({
    name: 'Ms. Anitha R', email: 'anitha@school.com',
    password: '123456', role: 'teacher', department: 'English',
    subjects: ['English'], classes: ['11A', '11B']
  });

  // Create leave balances for all teachers
  const teachers = [teacher1, teacher2, teacher3, teacher4];
  const year     = new Date().getFullYear();
  for (const t of teachers) {
    await LeaveBalance.create({ teacher: t._id, year });
  }

  // Create timetables
  await Timetable.create([
    {
      teacher: teacher1._id, dayOfWeek: 'Monday',
      periods: [
        { periodNumber:1, startTime:'09:00', endTime:'09:45', subject:'Physics',    className:'10A' },
        { periodNumber:3, startTime:'11:00', endTime:'11:45', subject:'Physics Lab',className:'10B' },
        { periodNumber:5, startTime:'13:00', endTime:'13:45', subject:'Physics',    className:'11A' },
      ]
    },
    {
      teacher: teacher1._id, dayOfWeek: 'Tuesday',
      periods: [
        { periodNumber:2, startTime:'09:50', endTime:'10:35', subject:'Physics',    className:'10A' },
        { periodNumber:4, startTime:'11:50', endTime:'12:35', subject:'Physics Lab',className:'11B' },
      ]
    },
    {
      teacher: teacher2._id, dayOfWeek: 'Monday',
      periods: [
        { periodNumber:2, startTime:'09:50', endTime:'10:35', subject:'Chemistry',  className:'10A' },
        { periodNumber:4, startTime:'11:50', endTime:'12:35', subject:'Chemistry',  className:'11A' },
      ]
    },
    {
      teacher: teacher2._id, dayOfWeek: 'Tuesday',
      periods: [
        { periodNumber:1, startTime:'09:00', endTime:'09:45', subject:'Chemistry',  className:'10A' },
        { periodNumber:3, startTime:'11:00', endTime:'11:45', subject:'Chemistry',  className:'11A' },
      ]
    },
    {
      teacher: teacher3._id, dayOfWeek: 'Monday',
      periods: [
        { periodNumber:1, startTime:'09:00', endTime:'09:45', subject:'Maths',      className:'10B' },
        { periodNumber:6, startTime:'14:00', endTime:'14:45', subject:'Maths',      className:'11B' },
      ]
    },
    {
      teacher: teacher3._id, dayOfWeek: 'Wednesday',
      periods: [
        { periodNumber:2, startTime:'09:50', endTime:'10:35', subject:'Maths',      className:'10B' },
        { periodNumber:5, startTime:'13:00', endTime:'13:45', subject:'Maths',      className:'11B' },
      ]
    },
  ]);

  console.log('✅ Seed complete! Login credentials:');
  console.log('   principal@school.com / 123456  (role: principal)');
  console.log('   hod@school.com / 123456        (role: hod)');
  console.log('   ravi@school.com / 123456        (role: teacher)');
  console.log('   priya@school.com / 123456       (role: teacher)');
  console.log('   mohan@school.com / 123456       (role: teacher)');
  console.log('   anitha@school.com / 123456      (role: teacher)');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });