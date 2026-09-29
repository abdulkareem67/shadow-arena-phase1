import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/protocol';
import type { GameRoom } from '../rooms/GameRoom';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerHandlers(io: IOServer, room: GameRoom): void {
  io.on('connection', (socket: IOSocket) => {
    socket.on('player:join', ({ username }) => {
      room.join(socket, username);
    });

    socket.on('player:input', (input) => {
      room.handleInput(socket.id, input);
    });

    socket.on('disconnect', () => {
      room.leave(socket.id);
    });
  });
}
