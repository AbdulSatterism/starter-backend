/* eslint-disable no-console */
import chalk from 'chalk';
import { Secret } from 'jsonwebtoken';
import { Server } from 'socket.io';
import config from '../config';
import { jwtHelper } from './jwtHelper';
import { logger } from '../shared/logger';

const socket = (io: Server) => {
  io.use((socket, next) => {
    try {
      const tokenFromAuth = socket.handshake.auth?.token;
      const authorizationHeader = socket.handshake.headers.authorization;
      const token =
        typeof tokenFromAuth === 'string' && tokenFromAuth.length > 0
          ? tokenFromAuth
          : typeof authorizationHeader === 'string' &&
              authorizationHeader.startsWith('Bearer ')
            ? authorizationHeader.split(' ')[1]
            : null;

      if (!token) {
        return next(new Error('Unauthorized socket connection'));
      }

      const decoded = jwtHelper.verifyToken(
        token,
        config.jwt.jwt_secret as Secret,
      );

      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', socket => {
    const userId =
      socket.data.user?.id?.toString?.() || socket.data.user?.id || 'anonymous';
    logger.info(chalk.green(`Socket connected: ${socket.id} (${userId})`));

    if (userId !== 'anonymous') {
      socket.join(`user:${userId}`);
    }

    socket.on('join', roomId => {
      if (typeof roomId === 'string' && roomId.trim().length > 0) {
        socket.join(roomId);
        logger.info(`User joined room: ${roomId}`);
      }
    });

    // socket.on('send-message', async ({ roomId, senderId, message }) => {
    //   try {
    //     // Save the message to the database
    //     const newMessage = await Message.create({
    //       roomId,
    //       senderId,
    //       message,
    //     });

    //     // Populate the senderId field
    //     const populatedMessage = await newMessage.populate(
    //       'senderId',
    //       'name email image',
    //     );

    //     // Emit the message to all users in the specified chat room
    //     io.emit(`receive-message:${populatedMessage.roomId}`, populatedMessage);
    //   } catch (error) {
    //     console.error('Error sending message:', error);
    //   }
    // });

    // // Listen for the chat-started event and emit to the specific room
    // socket.on('chat-started', ({ chatRoom }) => {
    //   io.to(chatRoom).emit(`chat-started:${chatRoom}`, {
    //     chatRoom,
    //     message: 'Chat started between the groups.',
    //   });
    // });

    // Handle disconnection
    socket.on('disconnect', reason => {
      logger.info(chalk.red(`Socket disconnected: ${socket.id} (${reason})`));
    });
  });
};

export default socket;

export const socketHelper = { socket };
