const express = require('express');
const router = express.Router();
const xss = require('xss');
const { auth } = require('../middleware/auth');
const Message = require('../models/Message');

// Get messages (paginated)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete message
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    message.isDeleted = true;
    message.text = 'This message was deleted';
    await message.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit message
router.patch('/:id', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Text required' });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    message.text = xss(text.trim().substring(0, 2000));
    message.isEdited = true;
    await message.save();
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
