// const express = require('express');
// const db = require('./database'); // Imports your MySQL connection
// const app = express();
// const PORT = 5000;

// // Allow Express to understand JSON requests
// app.use(express.json());

// // Dynamic API Endpoint to fetch real data from MySQL
// app.get('/api/grid', (req, res) => {
//   const sqlQuery = "SELECT * FROM substations";
  
//   db.query(sqlQuery, (err, results) => {
//     if (err) {
//       console.error("Database query error: ", err);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }
//     // Send the database rows back to the browser as JSON
//     res.json(results);
//   });
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server is running smoothly on http://localhost:${PORT}`);
// });

const express = require('express');
const db = require('./database'); 
const redis = require('redis');

const app = express();
const PORT = 5000;

app.use(express.json());

// 1. Initialize the Redis Client connection
// const redisClient = redis.createClient({
//     host: '127.0.0.1',
//     port: 6379 // Default Redis port
// });
    const redisClient = redis.createClient({
    RESP: 2,
    socket: {
        host: '127.0.0.1',
        port: 6379
    }
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis RAM Cache successfully!'));

// 2. Updated Grid API with RAM Caching
app.get('/api/grid', async (req, res) => {
  try {
    // Check if the grid data is already sitting in our Redis sticky note
    const cachedGrid = await redisClient.get('live_grid_data');

    if (cachedGrid) {
      console.log("⚡ Cache Hit! Loading directly from RAM...");
      return res.json(JSON.parse(cachedGrid));
    }

    // Cache Miss: If it's not in RAM, walk down to the MySQL basement
    console.log("📁 Cache Miss! Querying MySQL database...");
    const sqlQuery = "SELECT * FROM substations";

    db.query(sqlQuery, async (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      // Save the result inside Redis RAM so the next request is instant
      // EX: 60 means this cache expires and auto-deletes after 60 seconds
      await redisClient.setEx('live_grid_data', 60, JSON.stringify(results));

      res.json(results);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running smoothly on http://localhost:${PORT}`);
});