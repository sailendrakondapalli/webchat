// const mongoose = require('mongoose');
// const MessageSchema = new mongoose.Schema({
//   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   message: String,
//   timestamp: { type: Date, default: Date.now },
//   read: { type: Boolean, default: false }
// });
// module.exports = mongoose.model('Message', MessageSchema);

const mongoose = require('mongoose');
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String,
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});
module.exports = mongoose.model('Message', MessageSchema);
