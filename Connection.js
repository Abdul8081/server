
const mysql=require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',       // Replace with your host
    user: 'root',            // Replace with your MySQL username
    password: 'admin',    // Replace with your MySQL password
    database: 'abdul'      // Replace with your database name
  });
  
  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return;
    }
    console.log('Connected to the MySQL database!');
  });
  
  module.exports = connection;