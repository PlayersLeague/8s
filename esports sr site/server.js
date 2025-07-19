require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const User = require('./models/User');
const Match = require('./models/Match');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Black Ops 6 Ranked Play map pool
const MAP_POOL = ['Hacienda', 'Protocol', 'Red Card', 'Skyline', 'Vault'];

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  console.log('Register request:', { username, email }); // Debug
  try {
    if (!username || username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, sr: 1000, gamesPlayed: 0, victories: 0, losses: 0 });
    await user.save();
    console.log('User saved:', { _id: user._id, username, email, sr: user.sr, gamesPlayed: user.gamesPlayed, victories: user.victories, losses: user.losses }); // Debug
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Error registering: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login request:', { email }); // Debug
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email); // Debug
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      console.log('Invalid password for email:', email); // Debug
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for user:', user._id, 'Token:', token); // Debug
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error logging in: ' + err.message });
  }
});

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('No token provided'); // Debug
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded:', decoded); // Debug
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ message: 'Invalid token: ' + err.message });
  }
};

// User Routes
app.get('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('username email sr gamesPlayed victories losses');
    if (!user) {
      console.log('User not found for ID:', req.userId); // Debug
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('Profile fetched:', { _id: user._id, username: user.username, email: user.email, sr: user.sr, gamesPlayed: user.gamesPlayed, victories: user.victories, losses: user.losses }); // Debug
    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Error fetching profile: ' + err.message });
  }
});

app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      console.log('Invalid user ID:', req.params.id); // Debug
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id).select('username');
    if (!user) {
      console.log('User not found for ID:', req.params.id); // Debug
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User fetched:', { _id: req.params.id, username: user.username }); // Debug
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Error fetching user: ' + err.message });
  }
});

// Match Routes
app.post('/api/matches', authMiddleware, async (req, res) => {
  try {
    const match = new Match({ creator: req.userId, status: 'open', players: [req.userId], maxPlayers: 8, map: null });
    await match.save();
    console.log('Match created:', match); // Debug
    io.emit('matchUpdated');
    res.status(201).json({ match, message: 'Match created successfully' });
  } catch (err) {
    console.error('Error creating match:', err);
    res.status(500).json({ message: 'Error creating match: ' + err.message });
  }
});

app.get('/api/matches', authMiddleware, async (req, res) => {
  try {
    const matches = await Match.find({ status: 'open' });
    console.log('Matches fetched:', matches); // Debug
    res.json(matches);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ message: 'Error fetching matches: ' + err.message });
  }
});

app.post('/api/matches/:id/join', authMiddleware, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match || match.status !== 'open') {
      console.log('Invalid match:', req.params.id); // Debug
      return res.status(400).json({ message: 'Invalid match' });
    }
    if (match.players.includes(req.userId)) {
      console.log('User already in match:', req.userId); // Debug
      return res.status(400).json({ message: 'Already joined this match' });
    }
    if (match.players.length >= match.maxPlayers) {
      console.log('Match full:', req.params.id); // Debug
      return res.status(400).json({ message: 'Match is full' });
    }
    match.players.push(req.userId);
    if (match.players.length === match.maxPlayers) {
      match.status = 'closed';
      match.map = MAP_POOL[Math.floor(Math.random() * MAP_POOL.length)];
      console.log('Match closed, map selected:', match.map); // Debug
    }
    await match.save();
    console.log('Match joined:', match); // Debug
    io.emit('matchUpdated');
    res.json({ match, message: 'Joined match successfully' });
  } catch (err) {
    console.error('Error joining match:', err);
    res.status(500).json({ message: 'Error joining match: ' + err.message });
  }
});

app.post('/api/matches/:id/report', authMiddleware, async (req, res) => {
  const { winnerId, roundsWon } = req.body;
  try {
    const match = await Match.findById(req.params.id);
    if (!match || match.status !== 'closed') {
      console.log('Invalid match:', req.params.id); // Debug
      return res.status(400).json({ message: 'Invalid match' });
    }
    if (!match.players.includes(req.userId)) {
      console.log('User not in match:', req.userId); // Debug
      return res.status(403).json({ message: 'Only match players can report' });
    }
    if (!match.players.includes(winnerId)) {
      console.log('Winner not in match:', winnerId); // Debug
      return res.status(400).json({ message: 'Winner must be a match player' });
    }
    if (!roundsWon || roundsWon < 3 || roundsWon > 5) {
      console.log('Invalid rounds won:', roundsWon); // Debug
      return res.status(400).json({ message: 'Rounds won must be between 3 and 5' });
    }
    match.status = 'completed';
    match.roundsWon = roundsWon;
    await match.save();

    const winner = await User.findById(winnerId);
    const losers = await User.find({ _id: { $in: match.players.filter(p => p !== winnerId) } });
    if (winner && losers.length > 0) {
      const srGain = 15 * roundsWon; // Scale SR gain by rounds won
      winner.sr += srGain;
      winner.victories += 1;
      winner.gamesPlayed += 1;
      await winner.save();
      for (const loser of losers) {
        loser.sr = Math.max(0, loser.sr - 15);
        loser.losses += 1;
        loser.gamesPlayed += 1;
        await loser.save();
      }
      console.log('Match reported:', { matchId: req.params.id, winnerId, roundsWon, srGain }); // Debug
      io.emit('leaderboardUpdated');
      res.json({ message: 'Match reported' });
    } else {
      console.log('Winner or losers not found:', { winnerId, loserIds: match.players.filter(p => p !== winnerId) }); // Debug
      res.status(400).json({ message: 'Invalid winner or loser IDs' });
    }
  } catch (err) {
    console.error('Error reporting match:', err);
    res.status(500).json({ message: 'Error reporting match: ' + err.message });
  }
});

// Leaderboard Route
app.get('/api/users/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ username: { $exists: true, $ne: null }, sr: { $exists: true, $ne: null } })
      .sort({ sr: -1 })
      .limit(12)
      .select('_id username sr');
    console.log('Leaderboard users:', users); // Debug
    if (!users || users.length === 0) {
      console.log('No valid users found for leaderboard'); // Debug
      return res.status(200).json([]);
    }
    res.json(users);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Error fetching leaderboard: ' + err.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));