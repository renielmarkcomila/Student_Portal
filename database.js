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

  return db;
}

module.exports = {
  initializeDB
};
