require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const PORT = process.env.PORT || 4000;

const User = require('./models/User');
const Match = require('./models/Match');

const app = express();

// 1️⃣ Create HTTP server from Express app
const httpServer = http.createServer(app);

// 2️⃣ Attach Socket.IO to the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Optional: log new connections
io.on('connection', socket => {
  console.log('New Socket.IO connection:', socket.id);
  // you can add socket.on(...) handlers here if desired
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// (Your existing routes and controllers go here, unchanged)

// … Auth routes …
// … Middleware …
// … User routes …
// … Match routes …
// … Leaderboard route …

// 3️⃣ Listen on port 3000 using the shared HTTP server

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
