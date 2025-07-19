// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('username email sr gamesPlayed victories losses');
    if (!user) {
      console.log('User not found for ID:', req.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('Profile fetched:', { _id: user._id, username: user.username, email: user.email, sr: user.sr, gamesPlayed: user.gamesPlayed, victories: user.victories, losses: user.losses });
    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Error fetching profile: ' + err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      console.log('Invalid user ID:', req.params.id);
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id).select('username');
    if (!user) {
      console.log('User not found for ID:', req.params.id);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User fetched:', { _id: req.params.id, username: user.username });
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Error fetching user: ' + err.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ username: { $exists: true, $ne: null }, sr: { $exists: true, $ne: null } })
      .sort({ sr: -1 })
      .limit(12)
      .select('_id username sr');
    console.log('Leaderboard users:', users);
    if (!users || users.length === 0) {
      console.log('No valid users found for leaderboard');
      return res.status(200).json([]);
    }
    res.json(users);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Error fetching leaderboard: ' + err.message });
  }
});

module.exports = router;