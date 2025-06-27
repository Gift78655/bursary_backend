const mysql = require('mysql2');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: {
    ca: fs.readFileSync(path.resolve(__dirname, process.env.DB_SSL_CERT))
  }
});
module.exports = pool;
