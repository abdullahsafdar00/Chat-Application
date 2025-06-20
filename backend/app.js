const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const UserRoutes = require('./routes/user.routes');
const chatRoutes = require('./routes/chat.routes');
const getUserRoutes = require('./routes/getuser.routes');

require('dotenv').config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
  },
});



app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // your frontend URLs
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', getUserRoutes);
app.use('/api/auth', UserRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
  res.send('Chat backend running...');
});

const onlineUsers = new Map();

// Real-time logic
io.on('connection', (socket) => {
  console.log(`🟢 Connected: ${socket.id}`);

  socket.on('user_connected', (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} is online`);
    io.emit('update_online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('send_message', (data) => {
    console.log('📨 Message:', data);
    // Send to specific receiver if they're online
    const receiverSocketId = onlineUsers.get(data.receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_message', data);
    }
    // Don't send back to sender to avoid duplicates
  });

  socket.on('typing', ({ userId, receiverId, isTyping }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { userId, isTyping });
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        console.log(`🔴 User ${userId} went offline`);
        break;
      }
    }

    io.emit('update_online_users', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
