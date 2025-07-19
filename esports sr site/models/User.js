const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 3 },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  sr: { type: Number, default: 1000 },
  gamesPlayed: { type: Number, default: 0 },
  victories: { type: Number, default: 0 },
  losses: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);