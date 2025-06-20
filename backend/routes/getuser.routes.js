const express = require('express');
const router = express.Router();
const User = require('../models/user.model');

router.get('/all/:id', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.id } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
