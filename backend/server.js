require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const xss = require('xss');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Message = require('./models/Message');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Translate proxy (avoids exposing API key to frontend)
app.post('/api/translate', async (req, res) => {
  try {
    const { text, target } = req.body;
    if (!text || !target) return res.status(400).json({ error: 'Text and target required' });

    // Use MyMemory free API (no key needed, 1000 words/day)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus === 200) {
      res.json({ translated: data.responseData.translatedText });
    } else {
      res.status(500).json({ error: 'Translation failed' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Translation service error' });
  }
});

// Socket.io Authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isBlocked) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Active typing users
const typingUsers = new Map();

io.on('connection', async (socket) => {
  const user = socket.user;
  console.log(`User connected: ${user.username}`);

  // Set online
  await User.findByIdAndUpdate(user._id, { isOnline: true, lastSeen: new Date() });
  io.emit('user:status', { userId: user._id, username: user.username, isOnline: true, avatar: user.avatar });
  io.emit('user:new', { _id: user._id, username: user.username, isOnline: true, avatar: user.avatar, defaultLanguage: user.defaultLanguage });

  // Send message
  socket.on('message:send', async (data) => {
    try {
      const text = xss(data.text?.trim()?.substring(0, 2000));
      if (!text) return;

      const message = await Message.create({
        user: user._id,
        username: user.username,
        avatar: user.avatar,
        text
      });

      io.emit('message:new', {
        _id: message._id,
        user: user._id,
        username: user.username,
        avatar: user.avatar,
        text: message.text,
        isEdited: false,
        isDeleted: false,
        createdAt: message.createdAt
      });

      // Clear typing
      typingUsers.delete(user._id.toString());
      io.emit('typing:update', Array.from(typingUsers.values()));
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing
  socket.on('typing:start', () => {
    typingUsers.set(user._id.toString(), user.username);
    io.emit('typing:update', Array.from(typingUsers.values()));
  });

  socket.on('typing:stop', () => {
    typingUsers.delete(user._id.toString());
    io.emit('typing:update', Array.from(typingUsers.values()));
  });

  // Delete message
  socket.on('message:delete', async (messageId) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;
      if (message.user.toString() !== user._id.toString() && !user.isAdmin) return;
      message.isDeleted = true;
      message.text = 'This message was deleted';
      await message.save();
      io.emit('message:deleted', { _id: messageId });
    } catch (err) {}
  });

  // Edit message
  socket.on('message:edit', async ({ messageId, text }) => {
    try {
      const clean = xss(text?.trim()?.substring(0, 2000));
      if (!clean) return;
      const message = await Message.findById(messageId);
      if (!message || message.user.toString() !== user._id.toString()) return;
      message.text = clean;
      message.isEdited = true;
      await message.save();
      io.emit('message:edited', { _id: messageId, text: clean, isEdited: true });
    } catch (err) {}
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${user.username}`);
    typingUsers.delete(user._id.toString());
    io.emit('typing:update', Array.from(typingUsers.values()));
    await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen: new Date() });
    io.emit('user:status', { userId: user._id, username: user.username, isOnline: false });
  });
});

// Connect to MongoDB
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
const PORT = process.env.PORT || 5000; // PORTni bir marta aniqlash

app.listen(PORT, () => {               // keyin shu PORTni ishlatish
    console.log(`Server running on port ${PORT}`);
});
