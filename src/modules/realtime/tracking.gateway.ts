import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type LocationPayload = {
  shipmentId: number;
  userId: string;
  lat: number;
  lng: number;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // =============================
  // 🔌 CONEXIONES
  // =============================
  handleConnection(client: Socket) {
    console.log(`🟢 Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔴 Cliente desconectado: ${client.id}`);
  }

  // =============================
  // 📡 RECIBIR UBICACIÓN
  // =============================
  @SubscribeMessage('sendLocation')
  handleLocation(
    @MessageBody() data: LocationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('📡 Ubicación recibida por SOCKET:', data);

    this.emitLocation(data);

    // 🔔 TEST NOTIFICACIÓN (IMPORTANTE)
    this.emitNotification(data.userId, '📍 Nueva ubicación registrada');
  }

  // =============================
  // 📡 EMITIR TRACKING
  // =============================
  emitLocation(data: LocationPayload) {
    console.log('📡 EMITIENDO A CLIENTES:', data);

    this.server.emit(`tracking-${data.shipmentId}`, {
      shipmentId: data.shipmentId,
      userId: data.userId,
      lat: data.lat,
      lng: data.lng,
    });
  }

  // =============================
  // 🔔 EMITIR NOTIFICACIÓN
  // =============================
  emitNotification(userId: string, message: string) {
    console.log('🔔 Enviando notificación a:', userId);

    this.server.emit(`notification-${userId}`, {
      message,
    });
  }
}
