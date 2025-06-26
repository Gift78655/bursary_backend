// 📦 Dependencies 
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

// 📂 Document Upload
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✉️ Email Templates
const {
  generateApplicationEmail,
  generateWithdrawalEmail
} = require('./emailNotifications');

// 🚀 App Initialization
const app = express();

// ✅ CORS Setup for Render Frontend
const cors = require('cors');

const allowedOrigins = ['https://bursary-frontend.onrender.com'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight


app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = process.env.JWT_SECRET;

// 🛠️ Nodemailer Transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `"Bursary Portal" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
};

// 🛢️ MySQL Azure DB Connection (with optional SSL)
const certPath = path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem');
let sslConfig = undefined;

try {
  if (fs.existsSync(certPath)) {
    sslConfig = { ca: fs.readFileSync(certPath) };
    console.log('✅ SSL certificate loaded for Azure MySQL');
  } else {
    console.warn('⚠️ SSL certificate not found. Proceeding without SSL.');
  }
} catch (err) {
  console.error('❌ Error reading SSL cert:', err);
}

const db = mysql.createPool({
  host: process.env.DB_HOST,       // giftbursarydb01.mysql.database.azure.com
  user: process.env.DB_USER,       // mpho@giftbursarydb01
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,   // bursarydb
  port: 3306,
  ssl: sslConfig,
});

// ✅ Sanity Check Endpoint
app.get('/', (req, res) => {
  res.send('API is running ✅');
});

// 📥 Register Student
app.post('/api/register/student', async (req, res) => {
  const { full_name, email, password, phone, institution, field_of_study, year_of_study } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.query(
      `INSERT INTO students (full_name, email, password_hash, phone, institution, field_of_study, year_of_study)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email, hashed, phone, institution, field_of_study, year_of_study],
      (err) => {
        if (err) return res.status(500).json({ message: 'Student already exists or DB error', error: err });
        res.json({ message: 'Student registered successfully' });
      }
    );
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});


// 🔐 Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const table = role === 'admin' ? 'users' : 'students';
    const query = `SELECT * FROM ${table} WHERE email = ?`;

    db.query(query, [email], async (err, results) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = results[0];
      const passwordField = role === 'admin' ? user.password : user.password_hash;
      const isMatch = await bcrypt.compare(password, passwordField);

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const token = jwt.sign({ id: user.id, role: role }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.json({ token, user });
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// 👤 Get Student Profile
app.get('/api/students/:id', (req, res) => {
  const studentId = req.params.id;
  db.query(
    `SELECT full_name, email, phone, institution, field_of_study, year_of_study
     FROM students WHERE student_id = ?`,
    [studentId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      if (results.length === 0) return res.status(404).json({ message: 'Student not found' });
      res.json(results[0]);
    }
  );
});

// ✏️ Update Student Profile
app.put('/api/students/:id', (req, res) => {
  const studentId = req.params.id;
  const { phone, institution, field_of_study, year_of_study } = req.body;
  db.query(
    `UPDATE students SET phone = ?, institution = ?, field_of_study = ?, year_of_study = ?
     WHERE student_id = ?`,
    [phone, institution, field_of_study, year_of_study, studentId],
    (err) => {
      if (err) return res.status(500).json({ message: 'Update failed', error: err });
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// ➕ Create Bursary
app.post('/api/bursaries', (req, res) => {
  const {
    title, description, eligibility, field_of_study, institution,
    sponsor, amount, closing_date, application_url, contact_email,
    tags, created_by
  } = req.body;

  db.query(
    `INSERT INTO bursaries
     (title, description, eligibility, field_of_study, institution,
      sponsor, amount, closing_date, application_url, contact_email,
      tags, created_by, is_active, is_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
    [title, description, eligibility, field_of_study, institution,
     sponsor, amount, closing_date, application_url, contact_email,
     tags, created_by],
    (err) => {
      if (err) return res.status(500).json({ message: 'Insert failed', error: err });
      res.status(201).json({ message: 'Bursary created' });
    }
  );
});

// 📥 Get All Bursaries
app.get('/api/bursaries', (req, res) => {
  db.query('SELECT * FROM bursaries ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Query failed', error: err });
    res.json(results);
  });
});

// 📥 Get Only Available Bursaries
app.get('/api/bursaries/available', (req, res) => {
  db.query(
    'SELECT * FROM bursaries WHERE is_active = 1 AND is_verified = 1 ORDER BY closing_date ASC',
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Query failed', error: err });
      res.json(results);
    }
  );
});

// ✏️ Update Bursary
app.put('/api/bursaries/:id', (req, res) => {
  const id = req.params.id;
  const {
    title, description, eligibility, field_of_study, institution,
    sponsor, amount, closing_date, application_url, contact_email, tags
  } = req.body;

  db.query(
    `UPDATE bursaries SET title = ?, description = ?, eligibility = ?, field_of_study = ?, institution = ?,
     sponsor = ?, amount = ?, closing_date = ?, application_url = ?, contact_email = ?, tags = ?
     WHERE bursary_id = ?`,
    [title, description, eligibility, field_of_study, institution, sponsor,
     amount, closing_date, application_url, contact_email, tags, id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Update failed', error: err });
      res.json({ message: 'Bursary updated' });
    }
  );
});

// ❌ Delete Bursary
app.delete('/api/bursaries/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM bursaries WHERE bursary_id = ?', [id], (err) => {
    if (err) return res.status(500).json({ message: 'Delete failed', error: err });
    res.json({ message: 'Bursary deleted' });
  });
});

// 📝 Submit Application (and insert status_update)
app.post('/api/applications', (req, res) => {
  const { student_id, bursary_id } = req.body;

  db.query('SELECT * FROM applications WHERE student_id = ? AND bursary_id = ?', [student_id, bursary_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Query error', error: err });
    if (results.length > 0) return res.status(400).json({ message: 'Already applied' });

    db.query('INSERT INTO applications (student_id, bursary_id) VALUES (?, ?)', [student_id, bursary_id], (err, result) => {
      if (err) return res.status(500).json({ message: 'Insert failed', error: err });

      const application_id = result.insertId;

      db.query(`
        INSERT INTO status_updates (application_id, status, updated_by, remarks, updated_by_role, is_visible_to_student, action_type)
        VALUES (?, 'Submitted', ?, 'Application submitted by student', 'student', 1, 'Initial Submission')
      `, [application_id, student_id]);

      db.query(
        `SELECT s.email, s.full_name, b.title AS bursary_title
         FROM students s JOIN bursaries b ON b.bursary_id = ? WHERE s.student_id = ?`,
        [bursary_id, student_id],
        (err, result) => {
          if (!err && result.length > 0) {
            const { email, full_name, bursary_title } = result[0];
            const { subject, html } = generateApplicationEmail({ full_name, bursary_title });
            sendEmail(email, subject, html).catch(console.error);
          }
        }
      );

      res.status(201).json({ message: 'Application submitted and status logged' });
    });
  });
});

// 📂 Get Applications by Student
app.get('/api/applications', (req, res) => {
  const { student_id } = req.query;
  if (!student_id) return res.status(400).json({ message: 'student_id is required' });

  db.query(
    'SELECT bursary_id FROM applications WHERE student_id = ?',
    [student_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch', error: err });
      res.json(results);
    }
  );
});

// 🔄 Withdraw Application (Fixed: use POST instead of DELETE with body)
app.post('/api/applications/withdraw', (req, res) => {
  const { student_id, bursary_id } = req.body;

  if (!student_id || !bursary_id) {
    return res.status(400).json({ message: 'Missing student_id or bursary_id' });
  }

  db.query('DELETE FROM applications WHERE student_id = ? AND bursary_id = ?', [student_id, bursary_id], (err) => {
    if (err) return res.status(500).json({ message: 'Withdraw failed', error: err });

    db.query(
      `SELECT s.email, s.full_name, b.title AS bursary_title
       FROM students s JOIN bursaries b ON b.bursary_id = ? WHERE s.student_id = ?`,
      [bursary_id, student_id],
      (err2, result) => {
        if (!err2 && result.length > 0) {
          const { email, full_name, bursary_title } = result[0];
          const { subject, html } = generateWithdrawalEmail({ full_name, bursary_title });
          sendEmail(email, subject, html).catch(console.error);
        }
      }
    );

    res.json({ message: 'Application withdrawn' });
  });
});


// 🗂️ Get Full Admin View of Applications (with latest and history-ready structure)
app.get('/api/admin/applications', (req, res) => {
  const baseSQL = `
    SELECT 
      a.application_id,
      a.application_date,
      a.current_status,

      s.student_id,
      s.full_name AS student_name,
      s.email,
      s.phone,
      s.institution,
      s.field_of_study,
      s.year_of_study,

      b.bursary_id,
      b.title AS bursary_title,
      b.sponsor,
      b.amount,
      b.closing_date
    FROM applications a
    JOIN students s ON a.student_id = s.student_id
    JOIN bursaries b ON a.bursary_id = b.bursary_id
    ORDER BY a.application_date DESC
  `;

  db.query(baseSQL, (err, applications) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch applications', error: err });

    const appIds = applications.map(app => app.application_id);
    if (appIds.length === 0) return res.json([]);

    const placeholders = appIds.map(() => '?').join(',');
    const historySQL = `
      SELECT * FROM status_updates
      WHERE application_id IN (${placeholders})
      ORDER BY updated_at ASC
    `;

    db.query(historySQL, appIds, (err2, historyResults) => {
      if (err2) return res.status(500).json({ message: 'Failed to fetch status history', error: err2 });

      const historyMap = {};
      historyResults.forEach(update => {
        if (!historyMap[update.application_id]) {
          historyMap[update.application_id] = [];
        }
        historyMap[update.application_id].push(update);
      });

      const merged = applications.map(app => ({
        ...app,
        status_history: historyMap[app.application_id] || []
      }));

      res.json(merged);
    });
  });
});

// ✅ Admin updates application status (with email notification)
app.post('/api/status/update', (req, res) => {
  const {
    application_id, status, remarks, updated_by,
    updated_by_role, is_visible_to_student,
    action_type, attachment_url
  } = req.body;

  if (!application_id || !status || !updated_by || !updated_by_role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  db.query(
    `INSERT INTO status_updates
     (application_id, status, remarks, updated_by,
      updated_by_role, is_visible_to_student, action_type, attachment_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      application_id, status, remarks || '', updated_by,
      updated_by_role, is_visible_to_student ?? 1,
      action_type || '', attachment_url || ''
    ],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update status', error: err });

      db.query(
        `UPDATE applications SET current_status = ? WHERE application_id = ?`,
        [status, application_id],
        (err2) => {
          if (err2) console.error('Failed to sync current_status', err2);
        }
      );

      db.query(`
        SELECT s.full_name, s.email, b.title AS bursary_title
        FROM applications a
        JOIN students s ON a.student_id = s.student_id
        JOIN bursaries b ON a.bursary_id = b.bursary_id
        WHERE a.application_id = ?
      `, [application_id], (err3, results) => {
        if (err3) {
          console.error('Failed to fetch email info:', err3);
          return res.status(500).json({ message: 'Status updated but email failed' });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: 'Application not found for email notification' });
        }

        const { full_name, email, bursary_title } = results[0];

        const emailHTML = `
          <p>Dear ${full_name},</p>
          <p>Your application for the bursary <strong>${bursary_title}</strong> has been marked as: <strong>${status}</strong>.</p>
          <p>${remarks || 'Thank you for applying.'}</p>
          <p>Best regards,<br/>Bursary Office</p>
        `;

        const subject = `Bursary Status Update: ${status}`;

        sendEmail(email, subject, emailHTML)
          .then(() => {
            res.json({ message: 'Status updated and email sent' });
          })
          .catch(err4 => {
            console.error('❌ Email failed:', err4);
            res.status(500).json({ message: 'Status updated but failed to send email', error: err4 });
          });
      });
    }
  );
});

/// document upload section


// 🗂️ Ensure /uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// 🧩 Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 🧾 POST /api/upload-document
app.post('/api/upload-document', upload.single('file'), (req, res) => {
  const { application_id, student_id, category } = req.body;
  const file = req.file;

  if (!file || !application_id || !student_id || !category) {
    return res.status(400).json({ message: 'Missing required fields or file.' });
  }

  const file_name = file.filename;
  const original_name = file.originalname;
  const file_path = file.path;
  const file_type = file.mimetype;
  const file_size = file.size;
  const file_category = category;
  const uploaded_by_role = 'student';

  const sql = `
    INSERT INTO documents (
      application_id, student_id, file_name, original_name,
      file_path, file_type, file_size, file_category, uploaded_by_role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    application_id, student_id, file_name, original_name,
    file_path, file_type, file_size, file_category, uploaded_by_role
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error('Upload failed:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.status(201).json({ message: 'Document uploaded successfully.' });
  });
});

// 📬 GET /api/student/:studentId/documents
app.get('/api/student/:studentId/documents', (req, res) => {
  const studentId = req.params.studentId;

  db.query(
    `SELECT * FROM documents WHERE student_id = ? ORDER BY uploaded_at DESC`,
    [studentId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch documents', error: err });
      res.json(results);
    }
  );
});

// 🧾 GET /api/student/applications/:studentId
app.get('/api/student/applications/:studentId', (req, res) => {
  const studentId = req.params.studentId;

  db.query(
    `SELECT * FROM applications WHERE student_id = ? ORDER BY application_date DESC LIMIT 1`,
    [studentId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch application', error: err });
      res.json(results);
    }
  );
});

// ❌ DELETE /api/delete-document/:documentId
app.delete('/api/delete-document/:documentId', (req, res) => {
  const documentId = req.params.documentId;

  // Step 1: Find file path
  db.query('SELECT file_path FROM documents WHERE document_id = ?', [documentId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Document not found' });

    const filePath = results[0].file_path;

    // Step 2: Delete file from disk if exists
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.warn('⚠️ Could not delete file from disk:', unlinkErr);
      });
    }

    // Step 3: Delete DB record
    db.query('DELETE FROM documents WHERE document_id = ?', [documentId], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: 'Failed to delete document', error: deleteErr });
      res.json({ message: 'Document deleted successfully' });
    });
  });
});

/// end of document upload section


/// getting documents for viewing uploaded
// 📑 GET documents for a specific application
app.get('/api/applications/:applicationId/documents', (req, res) => {
  const applicationId = req.params.applicationId;

  db.query(
    `SELECT document_id, original_name, file_type, file_size, uploaded_at, file_category, file_path
     FROM documents
     WHERE application_id = ?
     ORDER BY uploaded_at DESC`,
    [applicationId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch documents', error: err });
      res.json(results);
    }
  );
});

/// end getting documents for viewing uploaded

///////////////////////////////////////////////
// 📚 Get all admins (for student dropdown or listing)
app.get('/api/admins', (req, res) => {
  db.query(
    `SELECT admin_id, full_name, email FROM admins ORDER BY full_name ASC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch admins', error: err });
      res.json(results);
    }
  );
});

///////////////////////////////////////////////


/// messaging in between the admin and student
// 📚 Get all students (for admin dropdown)
// 📚 Get all students (for admin dropdown)
app.get('/api/students', (req, res) => {
  db.query(
    `SELECT student_id, full_name, email FROM students ORDER BY full_name ASC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch students', error: err });
      res.json(results);
    }
  );
});

// 🟩 Auto-initiate conversation when admin selects student
app.post('/api/conversations/initiate', (req, res) => {
  const { student_id, admin_id } = req.body;

  if (!student_id || !admin_id || isNaN(student_id) || isNaN(admin_id)) {
    return res.status(400).json({ message: 'Missing or invalid student_id or admin_id' });
  }

  console.log('📩 /conversations/initiate ->', { student_id, admin_id });

  const checkSQL = `
    SELECT conversation_id FROM conversations
    WHERE student_id = ? AND admin_id = ?
  `;

  db.query(checkSQL, [student_id, admin_id], (checkErr, result) => {
    if (checkErr) {
      console.error('❌ Check failed:', checkErr);
      return res.status(500).json({ message: 'Check failed', error: checkErr });
    }

    if (result.length > 0) {
      return res.status(200).json({
        message: 'Conversation already exists',
        conversation_id: result[0].conversation_id
      });
    }

    const insertSQL = `
      INSERT INTO conversations (student_id, admin_id)
      VALUES (?, ?)
    `;

    db.query(insertSQL, [student_id, admin_id], (insertErr, insertResult) => {
      if (insertErr) {
        console.error('❌ Conversation insert failed:', insertErr);
        return res.status(500).json({ message: 'Conversation creation failed', error: insertErr });
      }

      res.status(201).json({
        message: 'Conversation created successfully',
        conversation_id: insertResult.insertId
      });
    });
  });
});

// 📥 Get all admins a student has conversed with
app.get('/api/conversations/student/:studentId', (req, res) => {
  const { studentId } = req.params;

  db.query(
    `SELECT c.conversation_id, a.admin_id, a.full_name, a.email
     FROM conversations c
     JOIN admins a ON a.admin_id = c.admin_id
     WHERE c.student_id = ?`,
    [studentId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch conversations for student', error: err });
      res.json(results);
    }
  );
});

// 📥 Get all students an admin has messaged
app.get('/api/conversations/admin/:adminId', (req, res) => {
  const { adminId } = req.params;

  db.query(
    `SELECT c.conversation_id, s.student_id, s.full_name, s.email
     FROM conversations c
     JOIN students s ON s.student_id = c.student_id
     WHERE c.admin_id = ?`,
    [adminId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch conversations for admin', error: err });
      res.json(results);
    }
  );
});

// 📨 Send message (requires conversation_id)
app.post('/api/messages/send', (req, res) => {
  const {
    conversation_id,
    sender_id,
    receiver_id,
    sender_role,
    message,
    message_type,
    attachment_url
  } = req.body;

  console.log('📤 Incoming Message Payload:', {
    conversation_id,
    sender_id,
    receiver_id,
    sender_role,
    message,
    message_type,
    attachment_url
  });

  if (
    !conversation_id ||
    !sender_id ||
    !receiver_id ||
    !sender_role ||
    typeof message !== 'string'
  ) {
    return res.status(400).json({ message: 'Missing or invalid fields to send message' });
  }

  // ✅ Determine correct foreign key reference table
  const receiverTable = sender_role === 'admin' ? 'students' : 'admins';
  const receiverField = sender_role === 'admin' ? 'student_id' : 'admin_id';

  const checkSQL = `SELECT ${receiverField} FROM ${receiverTable} WHERE ${receiverField} = ?`;

  db.query(checkSQL, [receiver_id], (checkErr, result) => {
    if (checkErr || result.length === 0) {
      return res.status(400).json({ message: 'Receiver does not exist' });
    }

    const insertSQL = `
      INSERT INTO messages (
        conversation_id, sender_id, receiver_id, sender_role,
        message, message_type, attachment_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertSQL, [
      conversation_id,
      sender_id,
      receiver_id,
      sender_role,
      message,
      message_type || 'text',
      attachment_url || null
    ], (err, result) => {
      if (err) {
        console.error('❌ Message insert failed:', err);
        return res.status(500).json({
          message: 'Failed to send message. DB error.',
          error: err.message || err
        });
      }

      res.status(201).json({
        message: 'Message sent successfully',
        message_id: result.insertId
      });
    });
  });
});

// 💬 Get full message history for a conversation
app.get('/api/messages/conversation/:conversationId', (req, res) => {
  const { conversationId } = req.params;

  db.query(
    `SELECT * FROM messages
     WHERE conversation_id = ?
     AND sender_deleted = 0 AND receiver_deleted = 0
     ORDER BY sent_at ASC`,
    [conversationId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to load messages', error: err });
      res.json(results);
    }
  );
});

// ✅ Mark all messages as read
app.post('/api/messages/mark-read', (req, res) => {
  const { conversation_id, user_id, role } = req.body;

  if (!conversation_id || !user_id || !role) {
    return res.status(400).json({ message: 'Missing required fields to mark as read' });
  }

  db.query(
    `UPDATE messages
     SET is_read = 1
     WHERE conversation_id = ? AND receiver_id = ? AND sender_role != ?`,
    [conversation_id, user_id, role],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to mark messages as read', error: err });
      res.json({ message: 'Messages marked as read' });
    }
  );
});

/// end messaging in between the admin and student

/// start for the student to view their application
// 🗂️ Get all applications with bursary details for a specific student
app.get('/api/student/:studentId/applications', (req, res) => {
  const studentId = req.params.studentId;

  const sql = `
    SELECT 
      a.application_id,
      a.application_date,
      a.current_status,
      b.title AS bursary_title,
      b.sponsor,
      b.amount,
      b.closing_date
    FROM applications a
    JOIN bursaries b ON a.bursary_id = b.bursary_id
    WHERE a.student_id = ?
    ORDER BY a.application_date DESC
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error('❌ Failed to fetch student applications:', err);
      return res.status(500).json({ message: 'Failed to fetch applications', error: err });
    }
    res.json(results);
  });
});


/// end for the student to view their application

/// start admin profile view
// 👤 Get Admin Profile
app.get('/api/admins/:id', (req, res) => {
  const adminId = req.params.id;
  db.query(
    `SELECT full_name, email, role FROM admins WHERE admin_id = ?`,
    [adminId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      if (results.length === 0) return res.status(404).json({ message: 'Admin not found' });
      res.json(results[0]);
    }
  );
});

// ✏️ Update Admin Profile
app.put('/api/admins/:id', (req, res) => {
  const adminId = req.params.id;
  const { full_name, email, role } = req.body;

  if (!full_name || !email || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  db.query(
    `UPDATE admins SET full_name = ?, email = ?, role = ? WHERE admin_id = ?`,
    [full_name, email, role, adminId],
    (err) => {
      if (err) return res.status(500).json({ message: 'Update failed', error: err });
      res.json({ message: 'Profile updated successfully' });
    }
  );
});
/// end admin profile view

/// start improving the admin profile

// 📥 Register Admin (Enhanced with full schema fields)

app.post('/api/register/admin', async (req, res) => {
  const {
    full_name,
    email,
    password,
    role = 'admin',
    profile_photo_url = '',
    address = '',
    phone = '',
    department = '',
    position_title = '',
    bio = ''
  } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields: full_name, email, or password.' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    const insertSQL = `
      INSERT INTO admins (
        full_name,
        email,
        password_hash,
        role,
        profile_photo_url,
        address,
        phone,
        department,
        position_title,
        bio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      full_name.trim(),
      email.trim().toLowerCase(),
      hashed,
      role,
      profile_photo_url.trim(),
      address.trim(),
      phone.trim(),
      department.trim(),
      position_title.trim(),
      bio.trim()
    ];

    db.query(insertSQL, values, (err) => {
      if (err) {
        console.error('❌ Admin registration error:', err);
        return res.status(500).json({ message: 'Admin already exists or database error', error: err });
      }

      res.status(201).json({ message: '✅ Admin registered successfully' });
    });

  } catch (err) {
    console.error('❌ Hashing or server error:', err);
    res.status(500).json({ message: 'Server error during registration', error: err });
  }
});


/// end improving the admin profile

// 🏁 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

