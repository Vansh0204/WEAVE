const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Minimal auth for hackathon: just registering/fetching a user by name
router.post('/login', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    let user = await User.findOne({ name });
    
    if (!user) {
      user = new User({ name });
      await user.save();
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

module.exports = router;
