const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status: { type: String, default: 'open', enum: ['open', 'closed', 'completed'] },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  maxPlayers: { type: Number, default: 8 },
  map: { type: String, default: null },
  roundsWon: { type: Number, default: 0 }
});

module.exports = mongoose.model('Match', matchSchema);