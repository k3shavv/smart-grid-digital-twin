const mysql = require('mysql');

// Configure the database connection details
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',      // Default MySQL username
  password: 'Champion',      // Leave blank if using XAMPP, or type your MySQL password
  database: 'smart_grid'
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