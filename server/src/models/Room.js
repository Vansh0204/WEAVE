const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  hostName: {
    type: String,
    required: true
  },
  // We can eventually store the serialized Yjs CRDT binary state here to load up old whiteboards
  crdtState: {
    type: Buffer,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
