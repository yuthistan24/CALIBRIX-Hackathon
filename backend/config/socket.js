const { Server } = require('socket.io');

const ChatMessage = require('../models/ChatMessage');

function configureSocketServer(server, jwt, jwtSecret) {
  const io = new Server(server, {
    cors: {
      origin: '*'
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, jwtSecret);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, role } = socket.user;
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);
    io.emit('presence:update', { userId, role, online: true });

    socket.on('chat:join', ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on('chat:typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('chat:typing', {
        roomId,
        isTyping,
        userId,
        role
      });
    });

    socket.on('chat:message', async (payload) => {
      const message = await ChatMessage.create({
        roomId: payload.roomId,
        student: payload.studentId || null,
        counselor: payload.counselorId || null,
        senderRole: role,
        senderId: userId,
        recipientId: payload.recipientId,
        message: payload.message,
        sentiment: payload.sentiment || null
      });

      io.to(payload.roomId).emit('chat:message', message);
    });

    socket.on('disconnect', () => {
      io.emit('presence:update', { userId, role, online: false });
    });
  });

  return io;
}

module.exports = {
  configureSocketServer
};
