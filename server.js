// 📦 Dependencies 
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

/// 📂 Document Upload
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  generateApplicationEmail,
  generateWithdrawalEmail
} = require('./emailNotifications');

// 🚀 App Init
const app = express();

// ✅ Optimized CORS for Render
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

// 🛢️ Database Connection with correct Render path to secret file
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: {
    ca: fs.readFileSync('/etc/secrets/DigiCertGlobalRootCA.crt.pem')  // ✅ Updated for Render secret path
  }
});

// ✅ Sanity check
app.get('/', (req, res) => {
  res.send('API is running ✅');
});


// ⬇️ Mount All Routes
const routes = require('./router.js'); // ✅ Explicit .js extension for Render compatibility
app.use(routes);


// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
});
