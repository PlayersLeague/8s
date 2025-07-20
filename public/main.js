const API_BASE = 'http://localhost:4000/api';
const socket = io();

const sections = {
  home: document.getElementById('homeSection'),
  login: document.getElementById('loginSection'),
  profile: document.getElementById('profileSection'),
  matches: document.getElementById('matchesSection'),
  leaderboard: document.getElementById('leaderboardSection')
};

const links = {
  home: document.getElementById('homeLink'),
  matches: document.getElementById('matchesLink'),
  leaderboard: document.getElementById('leaderboardLink'),
  profile: document.getElementById('profileLink'),
  logout: document.getElementById('logoutLink')
};

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const createMatchBtn = document.getElementById('createMatchBtn');
const matchesList = document.getElementById('matchesList');
const leaderboardBody = document.getElementById('leaderboardBody');
const reportForm = document.getElementById('reportForm');
const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));

// Rank logic based on SR (adjust thresholds as needed)
const getRank = (sr) => {
  if (sr < 800) return { name: 'Rookie', class: 'rank-rookie' };
  if (sr < 1200) return { name: 'Amateur', class: 'rank-amateur' };
  if (sr < 1600) return { name: 'All-Star', class: 'rank-allstar' };
  if (sr < 2000) return { name: 'Veteran', class: 'rank-veteran' };
  return { name: 'Legend', class: 'rank-legend' };
};

// Show/hide sections
const showSection = (sectionKey) => {
  Object.values(sections).forEach(sec => sec && (sec.style.display = 'none'));
  if (sections[sectionKey]) sections[sectionKey].style.display = 'block';
};

// Update UI based on login status
const updateUI = async () => {
  const token = localStorage.getItem('token');
  if (token) {
    // Logged in
    if (sections.login) sections.login.style.display = 'none';
    [links.matches, links.leaderboard, links.profile, links.logout].forEach(link => link && (link.parentElement.style.display = 'block'));
    await fetchProfile();
    await fetchMatches();
    await fetchLeaderboard();
    showSection('home');
  } else {
    // Logged out
    [links.matches, links.leaderboard, links.profile, links.logout].forEach(link => link && (link.parentElement.style.display = 'none'));
    if (sections.login) sections.login.style.display = 'block';
    showSection('login');
  }
};

// API helper with auth
const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  // Make sure headers lives _inside_ options, not alongside it
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  // 2. Spread options here so method/body actually get applied
  const res = await fetch(`${API_BASE}${endpoint}`, { 
    ...options,
    headers
  });

  if (!res.ok) {
    // pull the real error message
    const err = await res.json();
    throw new Error(err.message || 'API error');
  }
  return res.json();
};

// Fetch and display profile
const fetchProfile = async () => {
  try {
    const user = await apiFetch('/users/me');
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileGamesPlayed').textContent = user.gamesPlayed;
    document.getElementById('profileVictories').textContent = user.victories;
    document.getElementById('profileLosses').textContent = user.losses;
    document.getElementById('profileSr').textContent = user.sr;
    const rank = getRank(user.sr);
    const rankText = document.querySelector('.rank-text');
    rankText.textContent = `Rank: ${rank.name}`;
    rankText.className = `rank-text ${rank.class}`;
    // If you have rank images, set src: document.querySelector('.rank-image').src = `/images/${rank.name.toLowerCase()}.png`;
  } catch (err) {
    alert(`Error fetching profile: ${err.message}`);
  }
};

// Fetch and display matches
const fetchMatches = async () => {
  try {
    const matches = await apiFetch('/matches');
    matchesList.innerHTML = '';
    for (const match of matches) {
      const players = await Promise.all(match.players.map(id => apiFetch(`/users/${id}`).then(u => u.username)));
      const div = document.createElement('div');
      div.className = 'list-group-item';
      div.innerHTML = `
        <strong>Match ID:</strong> ${match._id}<br>
        <strong>Players:</strong> ${players.join(', ')} (${match.players.length}/${match.maxPlayers})<br>
        <strong>Status:</strong> ${match.status}
      `;
      if (match.status === 'open' && match.players.length < match.maxPlayers) {
        const joinBtn = document.createElement('button');
        joinBtn.className = 'btn btn-info ml-2';
        joinBtn.textContent = 'Join';
        joinBtn.onclick = () => joinMatch(match._id);
        div.appendChild(joinBtn);
      } else if (match.status === 'closed') {
        div.innerHTML += `<br><strong>Map:</strong> ${match.map}`;
        const reportBtn = document.createElement('button');
        reportBtn.className = 'btn btn-primary ml-2';
        reportBtn.textContent = 'Report Result';
        reportBtn.onclick = () => {
          document.getElementById('matchId').value = match._id;
          reportModal.show();
        };
        div.appendChild(reportBtn);
      }
      matchesList.appendChild(div);
    }
  } catch (err) {
    alert(`Error fetching matches: ${err.message}`);
  }
};

// Join match
const joinMatch = async (id) => {
  try {
    const { message } = await apiFetch(`/matches/${id}/join`, { method: 'POST' });
    alert(message);
    fetchMatches();
  } catch (err) {
    alert(`Error joining: ${err.message}`);
  }
};

// Create match
const createMatch = async () => {
  try {
    const { message } = await apiFetch('/matches', { method: 'POST' });
    alert(message);
    fetchMatches();
  } catch (err) {
    alert(`Error creating match: ${err.message}`);
  }
};

// Report match
const reportMatch = async (e) => {
  e.preventDefault();
  const matchId = document.getElementById('matchId').value;
  const winnerId = document.getElementById('winnerId').value;
  const roundsWon = document.getElementById('roundsWon').value;
  try {
    const { message } = await apiFetch(`/matches/${matchId}/report`, {
      method: 'POST',
      body: JSON.stringify({ winnerId, roundsWon: parseInt(roundsWon) })
    });
    alert(message);
    reportModal.hide();
    fetchMatches();
    fetchLeaderboard();
    fetchProfile();
  } catch (err) {
    alert(`Error reporting: ${err.message}`);
  }
};

// Fetch and display leaderboard
const fetchLeaderboard = async () => {
  try {
    const users = await apiFetch('/users/leaderboard');
    leaderboardBody.innerHTML = '';
    users.forEach((user, index) => {
      const rank = getRank(user.sr);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${user.username}</td>
        <td>${user.sr}</td>
        <td><span class="rank-badge ${rank.class}">${rank.name}</span></td>
      `;
      leaderboardBody.appendChild(tr);
    });
  } catch (err) {
    alert(`Error fetching leaderboard: ${err.message}`);
  }
};

// Login
const login = async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const { token } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', token);
    updateUI();
  } catch (err) {
    alert(`Login failed: ${err.message}`);
  }
};

// Register
const register = async (e) => {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  try {
    const { token } = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
    localStorage.setItem('token', token);
    updateUI();
  } catch (err) {
    alert(`Registration failed: ${err.message}`);
  }
};

// Logout
const logout = () => {
  localStorage.removeItem('token');
  updateUI();
};

// Event listeners
loginForm.addEventListener('submit', login);
registerForm.addEventListener('submit', register);
createMatchBtn.addEventListener('click', createMatch);
reportForm.addEventListener('submit', reportMatch);
links.home.addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
links.matches.addEventListener('click', (e) => { e.preventDefault(); showSection('matches'); fetchMatches(); });
links.leaderboard.addEventListener('click', (e) => { e.preventDefault(); showSection('leaderboard'); fetchLeaderboard(); });
links.profile.addEventListener('click', (e) => { e.preventDefault(); showSection('profile'); fetchProfile(); });
links.logout.addEventListener('click', (e) => { e.preventDefault(); logout(); });

// Real-time updates
socket.on('matchUpdated', fetchMatches);
socket.on('leaderboardUpdated', fetchLeaderboard);

// Initial setup
updateUI();