const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static('public'));

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API endpoint to send a message to all clients
app.post('/send-message', (req, res) => {
  const message = req.body.message;
  if (message) {
    io.emit('broadcast', { message, from: 'Server' });
    res.json({ status: 'Message sent successfully.' });
  } else {
    res.status(400).json({ error: 'Message content is required.' });
  }
});

// Socket.IO connection handler
let nextUserId = 1;
const users = {};
const userNames = {};
const groups = {};

io.on('connection', (socket) => {
  const userId = nextUserId++;
  users[userId] = socket.id;
  socket.emit('register', userId);

  console.log(`User ${userId} connected with socket ID ${socket.id}`);
  console.log('Current users:', users);

  socket.on('set name', ({ userId, userName }) => {
    userNames[userId] = userName;
    console.log(`User ${userId} set name to ${userName}`);
  });

  socket.on('join group', ({ groupName }) => {
    socket.join(groupName);
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(userId);
    console.log(`User ${userId} joined group ${groupName}`);
  });

  socket.on('set status', ({ userId, userName, status, fileData, fileName, fileType }) => {
    io.emit('status update', { userName, status, fileData, fileName, fileType });
    console.log(`User ${userId} (${userName}) set status: ${status}`);
  });

  socket.on('private message', ({ to, message, timestamp, messageId, fromName }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', { from: userId, message, timestamp, messageId, fromName });
      console.log(`Sent private message from ${userId} (${fromName}) to ${to}`);
    } else {
      socket.emit('error', 'User not found or not connected.');
    }
  });

  socket.on('private file', ({ to, fileData, fileName, fileType, timestamp, messageId, fromName }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private file', { from: userId, fileData, fileName, fileType, timestamp, messageId, fromName });
      console.log(`Sent private file from ${userId} (${fromName}) to ${to}`);
    } else {
      socket.emit('error', 'User not found or not connected.');
    }
  });

  socket.on('group message', ({ groupName, message, timestamp, messageId, fromName }) => {
    io.to(groupName).emit('group message', { groupName, message, timestamp, messageId, fromName });
    console.log(`Sent group message from ${userId} (${fromName}) to group ${groupName}`);
  });

  socket.on('group file', ({ groupName, fileData, fileName, fileType, timestamp, messageId, fromName }) => {
    io.to(groupName).emit('group file', { groupName, fileData, fileName, fileType, timestamp, messageId, fromName });
    console.log(`Sent group file from ${userId} (${fromName}) to group ${groupName}`);
  });

  socket.on('delete message', ({ messageId }) => {
    io.emit('delete message', { messageId });
    console.log(`Message ${messageId} deleted`);
  });

  socket.on('update message', ({ messageId, newContent }) => {
    io.emit('update message', { messageId, newContent });
    console.log(`Message ${messageId} updated`);
  });

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
    delete users[userId];
    delete userNames[userId];
    for (const group in groups) {
      groups[group] = groups[group].filter(id => id !== userId);
    }
    console.log('Current users after disconnect:', users);
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
