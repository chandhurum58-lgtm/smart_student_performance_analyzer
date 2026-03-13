import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import multer from "multer";
import csvParser from "csv-parser";
import * as xlsx from "xlsx";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("students.db");
const upload = multer({ dest: "uploads/" });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    department TEXT,
    section TEXT,
    year TEXT,
    attendance REAL,
    internal_marks REAL,
    assignment_marks REAL,
    study_hours REAL,
    previous_marks REAL,
    prediction TEXT,
    risk_score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    ip_address TEXT,
    details TEXT,
    severity TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Security Firewall (WAF) Middleware
  app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    // Check if IP is blocked
    const isBlocked = db.prepare("SELECT * FROM blocked_ips WHERE ip = ?").get(ip);
    if (isBlocked) {
      return res.status(403).json({ error: "Access denied. Your IP is blacklisted." });
    }

    // Basic SQL Injection & XSS Detection
    const payload = JSON.stringify({ body: req.body, query: req.query, params: req.params });
    const suspiciousPatterns = [
      /UNION\s+SELECT/i,
      /<script>/i,
      /OR\s+1=1/i,
      /DROP\s+TABLE/i,
      /javascript:/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(payload)) {
        db.prepare("INSERT INTO security_logs (event_type, ip_address, details, severity) VALUES (?, ?, ?, ?)")
          .run("Suspicious Activity Detected", ip, `Pattern matched: ${pattern.toString()}`, "High");
        return res.status(400).json({ error: "Security violation detected." });
      }
    }

    next();
  });

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "chandru" && password === "chandru@123") {
      res.json({ success: true, user: { name: "Chandru", role: "admin" } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Student Routes
  app.get("/api/students", (req, res) => {
    const students = db.prepare("SELECT * FROM students ORDER BY created_at DESC").all();
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const s = req.body;
    const result = db.prepare(`
      INSERT INTO students (name, department, section, year, attendance, internal_marks, assignment_marks, study_hours, previous_marks, prediction, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s.name, s.department, s.section, s.year, s.attendance, s.internalMarks, s.assignmentMarks, s.studyHours, s.previousMarks, s.prediction, s.riskScore);
    
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/students/:id", (req, res) => {
    db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // CLEAR ALL DATA ROUTE
  app.delete("/api/students", (req, res) => {
    try {
      db.prepare("DELETE FROM students").run();
      res.json({ success: true, message: "All records cleared" });
    } catch (error) {
      console.error("Clear all error:", error);
      res.status(500).json({ error: "Failed to clear records" });
    }
  });

  // Dataset Upload
  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const students: any[] = [];

    try {
      if (ext === ".csv") {
        await new Promise((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(csvParser())
            .on("data", (data) => students.push(data))
            .on("end", resolve)
            .on("error", reject);
        });
      } else if (ext === ".xlsx" || ext === ".xls") {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        students.push(...data);
      }

      const insert = db.prepare(`
        INSERT INTO students (name, department, section, year, attendance, internal_marks, assignment_marks, study_hours, previous_marks, prediction, risk_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((rows) => {
        for (const row of rows) {
          // Map column names flexibly
          const name = row.name || row.StudentName || "Unknown";
          const dept = row.department || row.Department || "General";
          const section = row.section || row.Section || "A";
          const year = row.year || row.Year || "1st";
          const attendance = parseFloat(row.attendance || row.Attendance || 0);
          const internal = parseFloat(row.internal_marks || row.InternalMarks || 0);
          const assignment = parseFloat(row.assignment_marks || row.AssignmentMarks || 0);
          const study = parseFloat(row.study_hours || row.StudyHours || 0);
          const prev = parseFloat(row.previous_marks || row.PreviousMarks || 0);
          
          // Simple heuristic for prediction if not provided
          const avg = (internal + assignment + prev) / 3;
          const prediction = avg > 80 ? "Excellent" : avg > 60 ? "Good" : avg > 40 ? "Average" : "Poor";
          const riskScore = Math.max(0, 100 - (attendance * 0.4 + avg * 0.6));

          insert.run(name, dept, section, year, attendance, internal, assignment, study, prev, prediction, Math.round(riskScore));
        }
      });

      transaction(students);
      fs.unlinkSync(filePath);
      res.json({ success: true, count: students.length });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process dataset" });
    }
  });

  // Security Logs
  app.get("/api/security/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 50").all();
    res.json(logs);
  });

  app.get("/api/security/blocked", (req, res) => {
    const blocked = db.prepare("SELECT * FROM blocked_ips").all();
    res.json(blocked);
  });

  app.post("/api/security/block", (req, res) => {
    const { ip, reason } = req.body;
    db.prepare("INSERT OR REPLACE INTO blocked_ips (ip, reason) VALUES (?, ?)").run(ip, reason);
    res.json({ success: true });
  });

  app.delete("/api/security/block/:ip", (req, res) => {
    db.prepare("DELETE FROM blocked_ips WHERE ip = ?").run(req.params.ip);
    res.json({ success: true });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
