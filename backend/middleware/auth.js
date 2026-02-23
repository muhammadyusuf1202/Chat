const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account is blocked' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
};

module.exports = { auth, adminAuth };
