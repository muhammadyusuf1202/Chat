const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth, adminAuth } = require('../middleware/auth');
const User = require('../models/User');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `avatar_${req.user._id}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  }
});

// Get all users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ isOnline: -1, username: 1 }).lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    req.user.avatar = avatarUrl;
    await req.user.save();
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Block/Unblock user
router.patch('/:id/block', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isAdmin) return res.status(400).json({ error: 'Cannot block admin' });
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
