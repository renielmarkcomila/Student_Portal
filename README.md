# 🎓 Student Portal - CHCC Modernized

A premium, full-width Student Portal and Admin Dashboard designed for **Concepcion Holy Cross College Inc.** This system features a robust management interface, real-time academic policy enforcement, and a modern, animated user experience.

## ✨ Features

### 👨‍🎓 Student Dashboard
- **Subject Management**: View current enrolled courses with lecture and lab units.
- **Drop Request System**: Integrated logic to drop individual subjects or the entire semester.
- **Academic Policy Enforcement**: Hard-coded 2-week deadline (`2026-03-15`) for dropping subjects. The system automatically locks the UI and server-side routes after the deadline.
- **Grades & Attendance**: View student academic performance and attendance logs.
- **Notices & Announcements**: Stay updated with campus news through a categorized notification system.

### 👮 Admin Dashboard
- **Student Overview**: Full-width management table for all students.
- **Record Management**: Interactive modals to edit student subjects, view grades, check attendance, or purge accounts.
- **Real-time Updates**: Changes are persisted directly to a SQLite database.

## 🚀 Technology Stack
- **Backend**: Node.js (Built-in HTTP module)
- **Database**: SQLite (Persisted binary storage)
- **Frontend**: EJS (Embedded JavaScript templates)
- **Styling**: Vanilla CSS with modern animations and glassmorphism.

## 🛠️ Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/renielmarkcomila/Student_Portal.git
   cd Student_Portal
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   node server.js
   ```

4. **Access the portal**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔐 Login Credentials

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@chcc.edu.ph` | `admin123` |
| **Student (Demo)** | `makmak@chcc.edu.ph` | `12345` |

## 📁 Project Structure
- `/views`: EJS templates for all pages.
- `/public`: Static assets (CSS, Images, JS).
- `/data`: SQLite database and initial seeding scripts.
- `server.js`: Core server logic and routing.
- `database.js`: Database initialization and schema management.

---

*Modernized with 💙 for CHCC 2026.*
