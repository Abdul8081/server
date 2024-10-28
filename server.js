require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser'); // Parse incoming request bodies
const cors = require('cors'); // Handle cross-origin requests

const app = express();

// Middleware
app.use(cors()); // Allow requests from the frontend
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(express.json());

// Define a port
const port = 5000;

// Create a MySQL pool using the Promises API
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the connection to the database
pool.getConnection()
  .then((connection) => {
    console.log('Connected to the database');
    return connection.query('SELECT 1 + 1 AS solution')
      .then(([rows]) => {
        console.log('The solution is: ', rows[0].solution);
      })
      .finally(() => connection.release()); // Release the connection back to the pool
  })
  .catch((err) => {
    console.error('Database connection error: ', err);
    process.exit(1); // Exit on failure
  });

// Signup route to handle user registration
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, password]
    );
    res.status(201).json({ message: 'Signup successful!' });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ message: 'An error occurred during signup.' });
  }
});

// Login route to handle user authentication
app.post('/add-coach', async (req, res) => {
  const { name, age, experience, associated_with, username, password } = req.body;

  // Validate input
  if (!name || !age || !experience || !associated_with || !username || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if the username already exists
    const [existingUser] = await pool.query('SELECT * FROM coaches WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    // Query to get the current max ID from the 'coaches' table
    const [maxIdResult] = await pool.query('SELECT MAX(id) AS maxId FROM coaches');
    const newId = (maxIdResult[0].maxId || 0) + 1; // Increment max ID by 1

    // Insert the new coach with the generated ID
    const [insertResult] = await pool.query(
      `INSERT INTO coaches (id, name, age, experience, associated_with, username, password) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, name, age, experience, associated_with, username, password]
    );

    res.status(201).json({ message: 'Coach added successfully!', coachId: newId });
  } catch (error) {
    console.error('Error adding coach:', error);
    res.status(500).json({ message: 'An error occurred while adding the coach.', error: error.message });
  }
});


// for the validation of the login, initial app.post for the login
app.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    let query;
    if (role === 'coach') {
      query = 'SELECT * FROM coaches WHERE username = ? AND password = ?'; // Assuming you have a coaches table
    } else if (role === 'player') {
      query = 'SELECT * FROM players WHERE player_name = ? AND password = ?'; // Assuming you have a players table
    } else {
      return res.status(400).json({ message: 'Invalid role.' });
    }

    const [results] = await pool.query(query, [username, password]);
    
    if (results.length > 0) {
      res.status(200).json({ message: `Welcome, ${username}!`, role });
    } else {
      res.status(401).json({ message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});





// addition of the manage team
app.post('/add-team', async (req, res) => {
  const { name, game, location, coached_by } = req.body;

  if (!name || !game || !location || !coached_by) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Insert the new team into the database
    const [result] = await pool.query(
      'INSERT INTO teams (team_name, game_type, location, coach_id) VALUES (?, ?, ?, ?)',
      [name, game, location, coached_by]
    );
    

    res.status(201).json({ message: 'Team added successfully!', teamId: result.insertId });
  } catch (error) {
    console.error('Error adding team:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/coach', async (req, res) => {
  const coachName = req.query.name; // Fetch 'name' from query parameters

  if (!coachName) {
    return res.status(400).json({ error: 'Coach name is required' }); // Handle missing name
  }

  const query = `
    SELECT name, experience, age, team_name AS team, associated_with
    FROM coaches 
    LEFT JOIN teams t ON associated_with = t.id
    WHERE name = ?;
  `;

  try {
    const [result] = await pool.query(query, [coachName]);

    if (result.length === 0) {
      console.warn(`Coach with name ${coachName} not found.`);
      return res.status(404).json({ error: 'Coach not found' });
    }

    res.status(200).json(result[0]); // Send the first matching record
  } catch (error) {
    console.error('Database query error:', error); // Log the actual error
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API to Add a New Player
app.post('/add-player', async (req, res) => {
  const { name, position, age, team, email, password } = req.body;

  // Validate request payload
  if (!name || !position || !age || !team || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if the email already exists
    const [existingPlayer] = await pool.query('SELECT * FROM players WHERE email = ?', [email]);
    if (existingPlayer.length > 0) {
      return res.status(400).json({ message: 'Email already exists. Please use a different email.' });
    }

    // Insert new player into the database
    const [result] = await pool.query(
      'INSERT INTO players (player_name, position, age, team, email, password) VALUES (?, ?, ?, ?, ?, ?)',
      [name, position, age, team, email, password]
    );

    res.status(201).json({ message: 'Player added successfully!', playerId: result.insertId });
  } catch (error) {
    console.error('Error adding player:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/player/:player_name', async (req, res) => {
  const { player_name } = req.params; // Extract player_name from the route parameter

  try {
    const [rows] = await pool.query(
      'SELECT * FROM players WHERE player_name = ?',
      [player_name]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Player not found' });
    }

    res.json(rows[0]); // Send the first matching player data
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/initial_login', async (req, res) => {
  const { name, password } = req.body;

  console.log('JWT Secret Key:', process.env.JWT_SECRET_KEY); // Debugging log

  if (!name || !password) {
    return res.status(400).json({ message: 'Name and password are required.' });
  }

  try {
    const query = 'SELECT * FROM users WHERE name = ? AND password = ?';
    const [results] = await pool.query(query, [name, password]);

    if (results.length > 0) {
      const token = jwt.sign(
        { userId: results[0].id, role: results[0].role },
        process.env.JWT_SECRET_KEY || 'fallback_secret_key', // Fallback key
        { expiresIn: '1h' }
      );
      res.status(200).json({ message: `Welcome, ${name}!`, token });
    } else {
      res.status(401).json({ message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
