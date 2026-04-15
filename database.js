const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const jsonPath = path.join(__dirname, 'data', 'student.json');

async function initializeDB() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Students table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'student',
      studentNumber TEXT,
      name TEXT,
      data TEXT
    )
  `);

  // Announcements table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // Grades table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_code TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      midterm TEXT DEFAULT '',
      finals TEXT DEFAULT '',
      final_grade TEXT DEFAULT '',
      UNIQUE(student_id, subject_code)
    )
  `);

  const studentCount = await db.get('SELECT COUNT(*) as count FROM students');
  
  if (studentCount.count === 0) {
    console.log('Seeding database from student.json...');
    if (fs.existsSync(jsonPath)) {
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      const jsonData = JSON.parse(rawData);
      
      for (const student of jsonData.students || []) {
        await db.run(
          `INSERT INTO students (email, password, role, studentNumber, name, data) VALUES (?, ?, ?, ?, ?, ?)`,
          [student.email, student.password, 'student', student.studentNumber, student.name, JSON.stringify(student)]
        );
      }
    }
    
    // Create admin account
    await db.run(
      `INSERT INTO students (email, password, role, studentNumber, name, data) VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin@chcc.edu.ph', 'admin123', 'admin', 'ADMIN-001', 'System Administrator', JSON.stringify({
        email: 'admin@chcc.edu.ph',
        role: 'admin',
        name: 'System Administrator'
      })]
    );
    console.log('Database seeded successfully.');
  }

  // Seed announcements if empty
  const annCount = await db.get('SELECT COUNT(*) as count FROM announcements');
  if (annCount.count === 0) {
    await db.run(`INSERT INTO announcements (title, body, category) VALUES (?, ?, ?)`, [
      'Welcome to the New Student Portal',
      'The Student Portal System is now live. Students can view their grades, schedules, and academic information online. For concerns, please contact the admin office.',
      'Academic'
    ]);
    await db.run(`INSERT INTO announcements (title, body, category) VALUES (?, ?, ?)`, [
      'Midterm Examination Schedule Released',
      'The midterm examination schedule has been posted. Please check your respective departments for room assignments and specific exam dates. Good luck to all students!',
      'Academic'
    ]);
    await db.run(`INSERT INTO announcements (title, body, category) VALUES (?, ?, ?)`, [
      'Library Hours Extended',
      'The university library will remain open until 10 PM during the examination period. Students are encouraged to utilize the library resources for their review.',
      'Administrative'
    ]);
    console.log('Announcements seeded.');
  }

  return db;
}

module.exports = {
  initializeDB
};
