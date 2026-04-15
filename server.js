const http = require('http');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { initializeDB } = require('./database.js');

const PORT = 3000;
let db;

function getCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  rc && rc.split(';').forEach(c => {
    const parts = c.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

function renderView(res, view, data = {}) {
  const filePath = path.join(__dirname, 'views', view);
  ejs.renderFile(filePath, data, {}, (err, html) => {
    if (err) {
      console.error('EJS Error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Template error: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentTypes = {
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
}

function parseFormData(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    const params = new URLSearchParams(body);
    const data = {};
    for (const [key, value] of params) { data[key] = value; }
    callback(data);
  });
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // Static Assets
  if (url.startsWith('/public/') || url.startsWith('/images/') || url.startsWith('/css/')) {
    let servePath = url;
    if (url.startsWith('/images/') || url.startsWith('/css/')) {
      servePath = '/public' + url;
    }
    const filePath = path.join(__dirname, servePath.replace('/public', 'public'));
    return serveStatic(res, filePath);
  }

  // Session handling
  const cookies = getCookies(req);
  const userId = cookies.userId;
  let user = null;
  
  if (userId) {
    const dbUser = await db.get('SELECT * FROM students WHERE id = ?', [userId]);
    if (dbUser) {
      user = { ...JSON.parse(dbUser.data), ...dbUser };
    }
  }

  const publicRoutes = ['/', '/login', '/enroll'];
  const ext = path.extname(url);
  
  if (!user && !publicRoutes.includes(url) && !ext) {
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  // ROUTES
  if (method === 'GET' && url === '/') {
    if (user) {
      return res.writeHead(302, { 'Location': user.role === 'admin' ? '/admin/students' : '/dashboard' }).end();
    }
    return renderView(res, 'login.ejs', { title: 'Login' });
  }

  if (method === 'POST' && url === '/login') {
    parseFormData(req, async (formData) => {
      const { username, password } = formData;
      const dbUser = await db.get('SELECT * FROM students WHERE email = ? AND password = ?', [username, password]);
      
      if (dbUser) {
        res.writeHead(302, { 
          'Location': dbUser.role === 'admin' ? '/admin/students' : '/dashboard',
          'Set-Cookie': `userId=${dbUser.id}; HttpOnly; Path=/; Max-Age=3600`
        });
        res.end();
      } else {
        res.writeHead(302, { 'Location': '/?error=1' });
        res.end();
      }
    });
    return;
  }

  if (method === 'GET' && url === '/logout') {
    res.writeHead(302, { 
      'Location': '/',
      'Set-Cookie': `userId=; HttpOnly; Path=/; Max-Age=0`
    });
    return res.end();
  }

  // STUDENT ROUTES
  if (user && user.role !== 'admin') {
    const student = user;
    
    if (method === 'GET' && url === '/dashboard') return renderView(res, 'dashboard.ejs', { student });
    if (method === 'GET' && url === '/payment') return renderView(res, 'payment.ejs', { student });
    if (method === 'GET' && url === '/registration') return renderView(res, 'registration.ejs', { student });
    if (method === 'GET' && url === '/courses') return renderView(res, 'courses.ejs', { student });
    
    // Profile page
    if (method === 'GET' && url === '/profile') {
      return renderView(res, 'profile.ejs', { student });
    }

    const DROP_DEADLINE = new Date('2026-03-15');
    const dropDeadlinePassed = new Date() > DROP_DEADLINE;

    if (method === 'GET' && url === '/drop') return renderView(res, 'drop.ejs', { student, dropDeadlinePassed });

    // Grades/Result page — fetch real grades from DB
    if (method === 'GET' && url === '/result') {
      const gradesRows = await db.all('SELECT * FROM grades WHERE student_id = ?', [student.id]);
      return renderView(res, 'result.ejs', { student, grades: gradesRows });
    }

    // Notices/Announcements page — fetch from announcements table
    if (method === 'GET' && url === '/notice') {
      const announcements = await db.all('SELECT * FROM announcements ORDER BY created_at DESC');
      return renderView(res, 'notice.ejs', { student, announcements });
    }

    if (method === 'GET' && url === '/schedule') return renderView(res, 'schedule.ejs', { student });
    
    if (method === 'POST' && url === '/drop') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          if (new Date() > DROP_DEADLINE) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: 'Drop deadline has passed (2 weeks since start of semester).' }));
          }

          const data = JSON.parse(body);
          if (data.dropSemester) {
            student.subjects = [];
            student.totalUnits = 0;
          }
          else if (data.courseCode) {
            student.subjects = (student.subjects||[]).filter(s => s.code !== data.courseCode);
            let tu = 0;
            student.subjects.forEach(s => tu += (s.lecUnits || 0) + (s.labUnits || 0));
            student.totalUnits = tu;
          }
          await db.run('UPDATE students SET data = ? WHERE id = ?', [JSON.stringify(student), student.id]);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Action completed' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Server error' }));
        }
      });
      return;
    }
  }

  // ADMIN ROUTES
  if (user && user.role === 'admin') {
    if (url === '/admin') {
      return res.writeHead(302, { 'Location': '/admin/students' }).end();
    }
    
    if (method === 'GET' && url === '/admin/students') {
      const allStudents = await db.all("SELECT * FROM students WHERE role = 'student'");
      const parsedStudents = allStudents.map(s => ({ ...JSON.parse(s.data), ...s }));
      return renderView(res, 'admin.ejs', { admin: user, students: parsedStudents });
    }
    
    if (method === 'GET' && url === '/admin/campus') {
      return renderView(res, 'admin-campus.ejs', { admin: user });
    }
    
    if (method === 'GET' && url === '/admin/settings') {
      return renderView(res, 'admin-settings.ejs', { admin: user });
    }

    // Announcements management
    if (method === 'GET' && url === '/admin/announcements') {
      const announcements = await db.all('SELECT * FROM announcements ORDER BY created_at DESC');
      return renderView(res, 'admin-announcements.ejs', { admin: user, announcements });
    }

    if (method === 'POST' && url === '/admin/announcements/add') {
      parseFormData(req, async (formData) => {
        const { title, body, category } = formData;
        await db.run(
          `INSERT INTO announcements (title, body, category) VALUES (?, ?, ?)`,
          [title.trim(), body.trim(), category || 'General']
        );
        res.writeHead(302, { 'Location': '/admin/announcements' });
        res.end();
      });
      return;
    }

    if (method === 'POST' && url === '/admin/announcements/delete') {
      parseFormData(req, async (formData) => {
        await db.run('DELETE FROM announcements WHERE id = ?', [formData.announcementId]);
        res.writeHead(302, { 'Location': '/admin/announcements' });
        res.end();
      });
      return;
    }

    // Grade entry by admin
    if (method === 'POST' && url === '/admin/grades') {
      parseFormData(req, async (formData) => {
        const { studentId, subjectCode, subjectName, midterm, finals, finalGrade } = formData;
        await db.run(
          `INSERT INTO grades (student_id, subject_code, subject_name, midterm, finals, final_grade)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(student_id, subject_code) DO UPDATE SET
             midterm = excluded.midterm,
             finals = excluded.finals,
             final_grade = excluded.final_grade`,
          [studentId, subjectCode, subjectName, midterm || '', finals || '', finalGrade || '']
        );
        res.writeHead(302, { 'Location': '/admin/students' });
        res.end();
      });
      return;
    }

    // Edit student info
    if (method === 'POST' && url === '/admin/edit') {
      parseFormData(req, async (formData) => {
        const { studentId, name, course, year, email } = formData;
        const studentRow = await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
        if (studentRow) {
          let studentData = JSON.parse(studentRow.data);
          studentData.name = name;
          studentData.course = course;
          studentData.year = parseInt(year) || 1;
          studentData.email = email;
          await db.run(
            'UPDATE students SET name = ?, email = ?, data = ? WHERE id = ?',
            [name, email, JSON.stringify(studentData), studentId]
          );
        }
        res.writeHead(302, { 'Location': '/admin/students' });
        res.end();
      });
      return;
    }
    
    if (method === 'POST' && url === '/admin/purge') {
      parseFormData(req, async (formData) => {
        await db.run('DELETE FROM students WHERE id = ? AND role = "student"', [formData.studentId]);
        await db.run('DELETE FROM grades WHERE student_id = ?', [formData.studentId]);
        res.writeHead(302, { 'Location': '/admin/students' });
        res.end();
      });
      return;
    }

    if (method === 'POST' && url === '/admin/add') {
      parseFormData(req, async (formData) => {
        const { name, email, password, studentNumber, course } = formData;
        const newStudentData = {
          name, email, password, studentNumber,
          course, year: 1, semester: "1st Semester", totalUnits: 0,
          subjects: [], notices: [], finance: { totalAssessment:0, totalPaid:0, outstandingBalance:0 }
        };
        await db.run(
          `INSERT INTO students (email, password, role, studentNumber, name, data) VALUES (?, ?, ?, ?, ?, ?)`,
          [email, password, 'student', studentNumber, name, JSON.stringify(newStudentData)]
        );
        res.writeHead(302, { 'Location': '/admin/students' });
        res.end();
      });
      return;
    }

    if (method === 'POST' && url === '/admin/subjects') {
      parseFormData(req, async (formData) => {
        const { studentId, subjectList } = formData;
        const studentRow = await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
        if (studentRow) {
           let studentData = JSON.parse(studentRow.data);
           studentData.subjects = subjectList.split(',').map(s => {
             return { code: s.trim().toUpperCase(), name: 'Assigned Curriculum Unit', lecUnits: 3, labUnits: 0 };
           }).filter(s => s.code !== '');
           studentData.totalUnits = studentData.subjects.length * 3;
           await db.run('UPDATE students SET data = ? WHERE id = ?', [JSON.stringify(studentData), studentId]);
        }
        res.writeHead(302, { 'Location': '/admin/students' });
        res.end();
      });
      return;
    }
  }

  if (!res.headersSent) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Page Not Found</h1>');
  }
});

initializeDB().then(database => {
  db = database;
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
});