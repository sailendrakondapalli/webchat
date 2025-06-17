const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');
const Message = require('./models/Message');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers = new Map();

io.on('connection', socket => {
  socket.on('register_user', userId => {
    onlineUsers.set(userId, socket.id);
    io.emit('user_list_update', Array.from(onlineUsers.keys()));
  });

  socket.on('send_message', async ({ senderId, receiverId, message }) => {
    const msg = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message,
      timestamp: new Date(),
      read: false
    });
    const recvSocket = onlineUsers.get(receiverId);
    if (recvSocket) {
      io.to(recvSocket).emit('new_message', msg);
    }
  });

  socket.on('mark_as_read', async ({ senderId, receiverId }) => {
    await Message.updateMany(
      { sender: senderId, receiver: receiverId, read: false },
      { $set: { read: true } }
    );
    const senderSocket = onlineUsers.get(senderId);
    if (senderSocket) {
      io.to(senderSocket).emit('messages_read', { from: receiverId });
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, sid] of onlineUsers) {
      if (sid === socket.id) {
        onlineUsers.delete(userId);
        io.emit('user_list_update', Array.from(onlineUsers.keys()));
      }
    }
  });
});

// Auth
app.post('/register', async (req, res) => {
  const { username, password, gender, state } = req.body;
  if (!username || !password || !gender || !state)
    return res.status(400).json({ msg: 'Missing fields' });
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ msg: 'Username taken' });
  const hash = await bcrypt.hash(password, 10);
  const newUser = await User.create({ username, password: hash, gender, state });
  res.json(newUser);
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password))
    return res.status(401).json({ msg: 'Invalid credentials' });
  res.json(user);
});

// Get Online Users
app.get('/users/:userId', async (req, res) => {
  const { category, state } = req.query;
  const currentUserId = req.params.userId;
  const onlineIds = Array.from(onlineUsers.keys()).filter(id => id !== currentUserId);
  const filter = { _id: { $in: onlineIds.map(id => new mongoose.Types.ObjectId(id)) } };
  if (category) filter.gender = category;

  let users = await User.find(filter).lean();

  const unreadCounts = await Message.aggregate([
    { $match: { receiver: new mongoose.Types.ObjectId(currentUserId), read: false } },
    { $group: { _id: "$sender", count: { $sum: 1 } } }
  ]);
  const unreadMap = {};
  unreadCounts.forEach(({ _id, count }) => {
    unreadMap[_id.toString()] = count;
  });

  users.forEach(u => {
    u.unreadCount = unreadMap[u._id.toString()] || 0;
  });

  users.sort((a, b) => {
    const aSame = a.state === state, bSame = b.state === state;
    return (aSame === bSame) ? 0 : aSame ? -1 : 1;
  });

  res.json(users);
});

// Message APIs
app.post('/messages', async (req, res) => {
  const { senderId, receiverId, message } = req.body;
  const msg = await Message.create({
    sender: senderId,
    receiver: receiverId,
    message,
    timestamp: new Date(),
    read: false
  });
  res.json(msg);
});

app.get('/messages/:u1/:u2', async (req, res) => {
  const msgs = await Message.find({
    $or: [
      { sender: req.params.u1, receiver: req.params.u2 },
      { sender: req.params.u2, receiver: req.params.u1 }
    ]
  }).sort('timestamp');
  res.json(msgs);
});

app.put('/messages/read/:myId/:otherId', async (req, res) => {
  await Message.updateMany(
    { sender: req.params.otherId, receiver: req.params.myId, read: false },
    { $set: { read: true } }
  );
  res.json({ success: true });
});

server.listen(5000, () => console.log('✅ Server running on http://localhost:5000'));
