// controllers/matchController.js
const Match = require('../models/Match');
const User = require('../models/User');
const MAP_POOL = ['Hacienda', 'Protocol', 'Red Card', 'Skyline', 'Vault'];

exports.createMatch = async (req, res) => {
  try {
    const match = new Match({ creator: req.userId, status: 'open', players: [req.userId], maxPlayers: 8, map: null });
    await match.save();
    console.log('Match created:', match);
    req.io.emit('matchUpdated');
    res.status(201).json({ match, message: 'Match created successfully' });
  } catch (err) {
    console.error('Error creating match:', err);
    res.status(500).json({ message: 'Error creating match: ' + err.message });
  }
};

exports.getOpenMatches = async (req, res) => {
  try {
    const matches = await Match.find({ status: 'open' });
    console.log('Matches fetched:', matches);
    res.json(matches);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ message: 'Error fetching matches: ' + err.message });
  }
};

exports.joinMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match || match.status !== 'open') {
      console.log('Invalid match:', req.params.id);
      return res.status(400).json({ message: 'Invalid match' });
    }
    if (match.players.includes(req.userId)) {
      console.log('User already in match:', req.userId);
      return res.status(400).json({ message: 'Already joined this match' });
    }
    if (match.players.length >= match.maxPlayers) {
      console.log('Match full:', req.params.id);
      return res.status(400).json({ message: 'Match is full' });
    }
    match.players.push(req.userId);
    if (match.players.length === match.maxPlayers) {
      match.status = 'closed';
      match.map = MAP_POOL[Math.floor(Math.random() * MAP_POOL.length)];
      console.log('Match closed, map selected:', match.map);
    }
    await match.save();
    console.log('Match joined:', match);
    req.io.emit('matchUpdated');
    res.json({ match, message: 'Joined match successfully' });
  } catch (err) {
    console.error('Error joining match:', err);
    res.status(500).json({ message: 'Error joining match: ' + err.message });
  }
};

exports.reportMatch = async (req, res) => {
  const { winnerId, roundsWon } = req.body;
  try {
    const match = await Match.findById(req.params.id);
    if (!match || match.status !== 'closed') {
      console.log('Invalid match:', req.params.id);
      return res.status(400).json({ message: 'Invalid match' });
    }
    if (!match.players.includes(req.userId)) {
      console.log('User not in match:', req.userId);
      return res.status(403).json({ message: 'Only match players can report' });
    }
    if (!match.players.includes(winnerId)) {
      console.log('Winner not in match:', winnerId);
      return res.status(400).json({ message: 'Winner must be a match player' });
    }
    if (!roundsWon || roundsWon < 3 || roundsWon > 5) {
      console.log('Invalid rounds won:', roundsWon);
      return res.status(400).json({ message: 'Rounds won must be between 3 and 5' });
    }
    match.status = 'completed';
    match.roundsWon = roundsWon;
    await match.save();

    const winner = await User.findById(winnerId);
    const losers = await User.find({ _id: { $in: match.players.filter(p => p.toString() !== winnerId.toString()) } });
    if (winner && losers.length > 0) {
      const srGain = 15 * roundsWon;
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
      console.log('Match reported:', { matchId: req.params.id, winnerId, roundsWon, srGain });
      req.io.emit('leaderboardUpdated');
      res.json({ message: 'Match reported' });
    } else {
      console.log('Winner or losers not found:', { winnerId, loserIds: match.players.filter(p => p !== winnerId) });
      res.status(400).json({ message: 'Invalid winner or loser IDs' });
    }
  } catch (err) {
    console.error('Error reporting match:', err);
    res.status(500).json({ message: 'Error reporting match: ' + err.message });
  }
};