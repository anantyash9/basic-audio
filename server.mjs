// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static('public'));

io.on('connection', socket => {
  console.log('client connected:', socket.id);

  // relay all signalling messages “as-is” to the other peer in the room
  socket.on('signal', ({ room, data }) => socket.to(room).emit('signal', data));

  socket.on('join', room => {
    socket.join(room);
    const clients = io.sockets.adapter.rooms.get(room) || new Set();
    // Tell the 2nd entrant that the 1st one is ready so it can start the offer
    if (clients.size === 2) io.to(room).emit('ready');
  });

  socket.on('audio', ({ room, chunk }) => socket.to(room).emit('audio', chunk));

  socket.on('disconnect', () => console.log('client disconnected:', socket.id));
});



httpServer.listen(3000, () =>
  console.log('Open http://localhost:3000 in two tabs or laptops')
);
