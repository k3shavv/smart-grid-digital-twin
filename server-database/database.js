require('dotenv').config();
const mysql = require('mysql');

// Configure the database connection details from environment variables
const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_grid'
});

// Establish the connection
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL database successfully as id ' + connection.threadId);
});

module.exports = connection;