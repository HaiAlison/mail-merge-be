import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust to your frontend URL in production
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    try {
      const verify = this.jwtService.verify(token);
      const userId = verify.sub;
      if (userId) {
        // Join a room unique to this user
        client.join(`user_${userId}`);
        this.logger.log(
          `Client connected: ${client.id} - Joined room: user_${userId}`,
        );
      } else {
        this.logger.warn(`Client connected without userId: ${client.id}`);
      }
    } catch (err) {
      this.logger.error(`Error verifying token: ${client.id}`, err);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Emit an event specifically to one user
   */
  sendToUser(userId: string, event: string, payload: any) {
    this.server.to(`user_${userId}`).emit(event, payload);
    this.logger.debug(`Emitted event '${event}' to user_${userId}`);
  }
}
