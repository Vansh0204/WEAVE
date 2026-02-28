const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

router.post('/create', async (req, res) => {
  try {
    const { roomId, hostName } = req.body;
    if (!roomId || !hostName) return res.status(400).json({ error: 'Missing room data' });

    const existingRoom = await Room.findOne({ roomId });
    if (existingRoom) {
        return res.status(400).json({ error: 'Room already exists' });
    }

    const newRoom = new Room({ roomId, hostName });
    await newRoom.save();

    res.status(201).json({ room: newRoom });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating room' });
  }
});

router.get('/:roomId', async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.status(200).json({ room });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching room' });
    }
});

module.exports = router;
