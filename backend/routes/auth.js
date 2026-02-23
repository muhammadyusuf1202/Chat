const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existing) return res.status(400).json({ error: 'Username already taken' });

    const user = await User.create({ username, password });
    const token = generateToken(user._id);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account is blocked' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// Update profile (language, avatar)
router.patch('/profile', auth, async (req, res) => {
  try {
    const { defaultLanguage } = req.body;
    if (defaultLanguage) req.user.defaultLanguage = defaultLanguage;
    await req.user.save();
    res.json({ user: req.user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
