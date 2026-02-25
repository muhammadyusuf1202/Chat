const API = 'https://globalchat-i92vqhom.b4a.run/api';
const SOCKET_URL = 'https://globalchat-i92vqhom.b4a.run';

let socket = null;
let currentUser = null;
let token = localStorage.getItem('gc_token');
let allUsers = {};
let messages = {};
let page = 1;
let typingTimeout = null;
let currentLang = 'uz';
let contextMsgId = null;
let editMsgId = null;

// ======================== INIT ========================
window.addEventListener('DOMContentLoaded', async () => {
  if (token) await loadApp();
  else showAuth();
});

async function loadApp() {
  try {
    const res = await api('/auth/me');
    currentUser = res.user;
    currentLang = currentUser.defaultLanguage || 'uz';
    showApp();
    initSocket();
    await loadUsers();
    await loadMessages();
  } catch {
    token = null;
    localStorage.removeItem('gc_token');
    showAuth();
  }
}

function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  setMyProfile();
  document.getElementById('langSelect').value = currentLang;
  document.getElementById('profileLang').value = currentLang;
}

// ======================== AUTH ========================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const res = await api('/auth/login', 'POST', { username, password });
    token = res.token;
    localStorage.setItem('gc_token', token);
    currentUser = res.user;
    currentLang = currentUser.defaultLanguage || 'uz';
    showApp();
    initSocket();
    await loadUsers();
    await loadMessages();
  } catch (err) {
    errEl.textContent = err.message || 'Xatolik yuz berdi';
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  try {
    const res = await api('/auth/register', 'POST', { username, password });
    token = res.token;
    localStorage.setItem('gc_token', token);
    currentUser = res.user;
    currentLang = currentUser.defaultLanguage || 'uz';
    showApp();
    initSocket();
    await loadUsers();
    await loadMessages();
  } catch (err) {
    errEl.textContent = err.message || 'Xatolik yuz berdi';
  }
});

function switchTab(tab) {
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

async function logout() {
  if (socket) socket.disconnect();
  token = null;
  localStorage.removeItem('gc_token');
  currentUser = null;
  allUsers = {};
  messages = {};
  document.getElementById('messagesList').innerHTML = '';
  showAuth();
}

// ======================== SOCKET ========================
function initSocket() {
  socket = io(SOCKET_URL, { auth: { token } });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('connect_error', (e) => console.error('Socket error:', e.message));

  socket.on('user:new', (user) => {
    allUsers[user._id] = { ...allUsers[user._id], ...user };
    renderUsers();
  });

  socket.on('user:status', ({ userId, isOnline, avatar }) => {
    if (allUsers[userId]) {
      allUsers[userId].isOnline = isOnline;
      if (avatar) allUsers[userId].avatar = avatar;
    }
    renderUsers();
    updateMembersCount();
  });

  socket.on('message:new', (msg) => {
    if (!messages[msg._id]) {
      messages[msg._id] = msg;
      appendMessage(msg);
      scrollToBottom();
      if (msg.user !== currentUser._id) showNotification(`${msg.username}: ${msg.text.substring(0, 60)}`);
    }
  });

  socket.on('message:deleted', ({ _id }) => {
    if (messages[_id]) {
      messages[_id].isDeleted = true;
      messages[_id].text = 'Bu xabar o\'chirildi';
      const bubble = document.querySelector(`[data-msg-id="${_id}"] .msg-bubble`);
      if (bubble) {
        bubble.setAttribute('data-deleted', 'true');
        bubble.querySelector('.msg-text').textContent = 'Bu xabar o\'chirildi';
        const actions = bubble.querySelector('.msg-actions');
        if (actions) actions.remove();
      }
    }
  });

  socket.on('message:edited', ({ _id, text }) => {
    if (messages[_id]) {
      messages[_id].text = text;
      messages[_id].isEdited = true;
      const el = document.querySelector(`[data-msg-id="${_id}"]`);
      if (el) {
        el.querySelector('.msg-text').textContent = text;
        let edited = el.querySelector('.msg-edited');
        if (!edited) {
          edited = document.createElement('span');
          edited.className = 'msg-edited';
          el.querySelector('.msg-meta').prepend(edited);
        }
        edited.textContent = '✏️ tahrirlangan';
      }
    }
  });

  socket.on('typing:update', (typingList) => {
    const others = typingList.filter(u => u !== currentUser.username);
    const el = document.getElementById('typingIndicator');
    if (others.length === 0) {
      el.innerHTML = '';
    } else {
      const names = others.slice(0, 3).join(', ');
      el.innerHTML = `<span>${names} yozyapti</span> <span class="typing-dots"><span></span><span></span><span></span></span>`;
    }
  });
}

// ======================== USERS ========================
async function loadUsers() {
  try {
    const res = await api('/users');
    allUsers = {};
    res.users.forEach(u => allUsers[u._id] = u);
    renderUsers();
    updateMembersCount();
  } catch (err) {}
}

function renderUsers() {
  const list = document.getElementById('usersList');
  const search = document.getElementById('userSearch').value.toLowerCase();
  const users = Object.values(allUsers).filter(u => u.username.toLowerCase().includes(search));
  users.sort((a, b) => (b.isOnline - a.isOnline) || a.username.localeCompare(b.username));

  const online = users.filter(u => u.isOnline).length;
  document.getElementById('onlineCount').textContent = online;

  list.innerHTML = users.map(u => `
    <div class="user-item" id="ui_${u._id}">
      <div class="user-item-avatar">
        ${avatarTag(u, 34)}
        <span class="status-dot ${u.isOnline ? 'online' : 'offline'}"></span>
      </div>
      <div class="user-item-info">
        <div class="user-item-name">${escHtml(u.username)}${u.isAdmin ? ' 👑' : ''}${u.isBlocked ? ' 🚫' : ''}</div>
        <div class="user-item-status ${u.isOnline ? 'online' : ''}">${u.isOnline ? 'Online' : 'Offline'}</div>
      </div>
      ${currentUser.isAdmin && u._id !== currentUser._id ? `
        <div class="user-item-actions">
          <button class="block-btn ${u.isBlocked ? 'blocked' : ''}" onclick="toggleBlock('${u._id}')">${u.isBlocked ? 'Ochish' : 'Bloklash'}</button>
        </div>` : ''}
    </div>
  `).join('');
}

function filterUsers() { renderUsers(); }

function updateMembersCount() {
  const count = Object.keys(allUsers).length;
  document.getElementById('membersCount').textContent = `${count} ta a'zo`;
}

async function toggleBlock(userId) {
  try {
    const res = await api(`/users/${userId}/block`, 'PATCH');
    allUsers[userId] = res.user;
    renderUsers();
    showNotification(res.user.isBlocked ? 'Foydalanuvchi bloklandi' : 'Bloklash olib tashlandi');
  } catch (err) {}
}

// ======================== MESSAGES ========================
async function loadMessages() {
  try {
    const res = await api(`/messages?page=${page}`);
    const list = document.getElementById('messagesList');
    let lastDate = null;

    res.messages.forEach(msg => {
      messages[msg._id] = msg;
      const date = new Date(msg.createdAt).toDateString();
      if (date !== lastDate) {
        list.insertAdjacentHTML('beforeend', `<div class="date-separator">${formatDate(msg.createdAt)}</div>`);
        lastDate = date;
      }
      list.insertAdjacentHTML('beforeend', buildMessageHTML(msg));
    });

    scrollToBottom(false);
    if (res.messages.length < 50) document.getElementById('loadMore').classList.add('hidden');
  } catch (err) {}
}

async function loadMoreMessages() {
  page++;
  const container = document.getElementById('messagesContainer');
  const prevScroll = container.scrollHeight;
  await loadMessages();
  container.scrollTop = container.scrollHeight - prevScroll;
}

function appendMessage(msg) {
  const list = document.getElementById('messagesList');
  list.insertAdjacentHTML('beforeend', buildMessageHTML(msg));
}

function buildMessageHTML(msg) {
  const isOwn = msg.user === currentUser._id || msg.user?.toString() === currentUser._id?.toString();
  const cls = isOwn ? 'own' : 'other';
  const time = formatTime(msg.createdAt);

  const actionsHTML = !msg.isDeleted && isOwn ? `
    <div class="msg-actions">
      <button class="msg-action-btn" onclick="startEdit('${msg._id}')">✏️</button>
      <button class="msg-action-btn" onclick="deleteMessage('${msg._id}')">🗑️</button>
    </div>` : '';

  return `
    <div class="message ${cls}" data-msg-id="${msg._id}">
      <img class="msg-avatar" src="${getAvatar(msg)}" alt="${escHtml(msg.username)}" 
           onerror="this.src=defaultAvatar('${msg.username}')">
      <div class="msg-content">
        ${!isOwn ? `<div class="msg-username">${escHtml(msg.username)}</div>` : ''}
        <div class="msg-bubble" data-deleted="${msg.isDeleted}">
          ${actionsHTML}
          <span class="msg-text">${escHtml(msg.text)}</span>
        </div>
        <div class="msg-meta">
          <span class="msg-time">${time}</span>
          ${msg.isEdited ? '<span class="msg-edited">✏️ tahrirlangan</span>' : ''}
          ${!msg.isDeleted ? `<button class="translate-btn" onclick="translateMessage('${msg._id}')">🌐 Tarjima</button>` : ''}
        </div>
      </div>
    </div>`;
}

// ======================== SEND MESSAGE ========================
function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !socket) return;
  socket.emit('message:send', { text });
  input.value = '';
  input.style.height = 'auto';
  socket.emit('typing:stop');
  if (typingTimeout) clearTimeout(typingTimeout);
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function handleTyping() {
  const input = document.getElementById('messageInput');
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';

  if (!socket) return;
  socket.emit('typing:start');
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('typing:stop'), 2000);
}

// ======================== DELETE / EDIT ========================
function deleteMessage(msgId) {
  if (!confirm('Xabarni o\'chirishni xohlaysizmi?')) return;
  socket.emit('message:delete', msgId);
}

function startEdit(msgId) {
  editMsgId = msgId;
  const msg = messages[msgId];
  if (!msg) return;
  document.getElementById('editInput').value = msg.text;
  document.getElementById('editModal').classList.remove('hidden');
}

function saveEdit() {
  const text = document.getElementById('editInput').value.trim();
  if (!text || !editMsgId) return;
  socket.emit('message:edit', { messageId: editMsgId, text });
  closeEdit();
}

function closeEdit() {
  document.getElementById('editModal').classList.add('hidden');
  editMsgId = null;
}

// ======================== TRANSLATE ========================
async function translateMessage(msgId) {
  const msg = messages[msgId];
  if (!msg) return;
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!el) return;

  const existing = el.querySelector('.translated-text');
  if (existing) { existing.remove(); return; }

  try {
    const res = await api('/translate', 'POST', { text: msg.text, target: currentLang });
    const translated = document.createElement('div');
    translated.className = 'translated-text';
    translated.textContent = res.translated;
    el.querySelector('.msg-bubble').appendChild(translated);
  } catch {
    showNotification('Tarjima amalga oshmadi');
  }
}

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('langSelect').value = lang;
}

// ======================== PROFILE ========================
function setMyProfile() {
  const u = currentUser;
  document.getElementById('myUsername').textContent = u.username;
  const avatarEl = document.getElementById('myAvatar');
  avatarEl.src = u.avatar ? `http://localhost:5000${u.avatar}` : defaultAvatar(u.username);
}

function openProfile() {
  const u = currentUser;
  document.getElementById('profileName').textContent = u.username;
  document.getElementById('profileAvatar').src = u.avatar ? `http://localhost:5000${u.avatar}` : defaultAvatar(u.username);
  document.getElementById('profileLang').value = currentLang;
  if (u.isAdmin) document.getElementById('adminSection').classList.remove('hidden');
  document.getElementById('profileModal').classList.remove('hidden');
}

function closeProfile() {
  document.getElementById('profileModal').classList.add('hidden');
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  try {
    const res = await fetch(`${API}/users/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.avatar) {
      currentUser.avatar = data.avatar;
      const url = `http://localhost:5000${data.avatar}`;
      document.getElementById('myAvatar').src = url;
      document.getElementById('profileAvatar').src = url;
      showNotification('Profil rasm yangilandi!');
    }
  } catch { showNotification('Rasm yuklashda xatolik'); }
}

async function updateDefaultLang(lang) {
  currentLang = lang;
  document.getElementById('langSelect').value = lang;
  try {
    await api('/auth/profile', 'PATCH', { defaultLanguage: lang });
    currentUser.defaultLanguage = lang;
  } catch {}
}

// ======================== THEME ========================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.querySelector('.icon-btn[onclick="toggleTheme()"]').textContent = isDark ? '🌑' : '🌙';
}

// ======================== EMOJI ========================
function toggleEmoji() {
  document.getElementById('emojiBar').classList.toggle('open');
}

function addEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.value += emoji;
  input.focus();
}

// ======================== NOTIFICATIONS ========================
function showNotification(msg, duration = 3000) {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), duration);

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('GlobalChat', { body: msg });
  }
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ======================== HELPERS ========================
function scrollToBottom(smooth = true) {
  const c = document.getElementById('messagesContainer');
  c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Bugun';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Kecha';
  return d.toLocaleDateString('uz', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function defaultAvatar(username) {
  const colors = ['5b68f5', '3dd68c', 'f05252', 'f5a623', 'a855f7', '0ea5e9'];
  const color = colors[username.charCodeAt(0) % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${color}&color=fff&size=80&bold=true`;
}

function getAvatar(msg) {
  return msg.avatar ? `http://localhost:5000${msg.avatar}` : defaultAvatar(msg.username);
}

function avatarTag(u, size = 38) {
  const src = u.avatar ? `http://localhost:5000${u.avatar}` : defaultAvatar(u.username);
  return `<img class="avatar" src="${src}" width="${size}" height="${size}" alt="${escHtml(u.username)}" onerror="this.src=defaultAvatar('${u.username}')">`;
}

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

// Close modals on backdrop click
document.getElementById('profileModal').addEventListener('click', (e) => {
  if (e.target.id === 'profileModal') closeProfile();
});
document.getElementById('editModal').addEventListener('click', (e) => {
  if (e.target.id === 'editModal') closeEdit();
});
document.addEventListener('click', () => {
  document.getElementById('contextMenu').classList.add('hidden');
});
