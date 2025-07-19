// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  console.log('Register request:', { username, email });
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
    console.log('User saved:', { _id: user._id, username, email, sr: user.sr, gamesPlayed: user.gamesPlayed, victories: user.victories, losses: user.losses });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Error registering: ' + err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  console.log('Login request:', { email });
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      console.log('Invalid password for email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for user:', user._id, 'Token:', token);
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error logging in: ' + err.message });
  }
};