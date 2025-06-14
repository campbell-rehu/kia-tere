import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  jest,
} from '@jest/globals';
import { WebSocketServer } from '../WebSocketServer';
import { WebSocketMessage } from '../../types';

// Mock WebSocket class that implements the minimum required interface
class MockWebSocket {
  messages: WebSocketMessage[] = [];
  roomCode?: string;
  playerName?: string;
  readyState = 1; // OPEN
  onmessage?: (data: any) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
}

describe('WebSocketServer', () => {
  let server: WebSocketServer;
  let mockWs: MockWebSocket;
  let joinWs: MockWebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    server = new WebSocketServer();
    mockWs = new MockWebSocket();
    joinWs = new MockWebSocket();
    mockWs.readyState = 1;
    joinWs.readyState = 1;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    server.stopCleanupInterval();
    server.close();
  });

  describe('Room Management', () => {
    it('should create a room', () => {
      const createMessage: WebSocketMessage = {
        type: 'CREATE_ROOM',
        playerName: 'host',
      };

      server.handleMessage(mockWs as any, createMessage);
      mockWs.roomCode = mockWs.messages[0]?.roomCode;
      mockWs.playerName = createMessage.playerName;
      expect(mockWs.messages).toHaveLength(1);
      expect(mockWs.messages[0].type).toBe('ROOM_CREATED');
      expect(mockWs.messages[0].roomCode).toBeDefined();
      expect(mockWs.messages[0].players).toEqual(['host']);
      expect(mockWs.messages[0].connectedPlayers).toEqual(['host']);
      expect(mockWs.roomCode).toBe(mockWs.messages[0].roomCode);
    });

    it('should allow player to join room', () => {
      // Create room first
      const createMessage: WebSocketMessage = {
        type: 'CREATE_ROOM',
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, createMessage);
      mockWs.roomCode = mockWs.messages[0]?.roomCode;
      mockWs.playerName = createMessage.playerName;
      const roomCode = mockWs.messages[0].roomCode;

      // Join room
      const joinMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player1',
      };
      server.handleMessage(joinWs as any, joinMessage);
      joinWs.roomCode = roomCode;
      joinWs.playerName = joinMessage.playerName;

      expect(joinWs.messages).toHaveLength(1);
      expect(joinWs.messages[0].type).toBe('ROOM_JOINED');
      expect(joinWs.messages[0].roomCode).toBe(roomCode);
      expect(joinWs.roomCode).toBe(roomCode);
    });
  });

  describe('Game Flow Messages', () => {
    let roomCode: string;

    beforeEach(() => {
      // Create room and join player
      const createMessage: WebSocketMessage = {
        type: 'CREATE_ROOM',
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, createMessage);
      roomCode = mockWs.messages[0].roomCode;

      const joinMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player1',
      };
      server.handleMessage(joinWs as any, joinMessage);

      // Start game
      const startMessage: WebSocketMessage = {
        type: 'START_GAME',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startMessage);
    });

    it('should handle START_TURN message', () => {
      const startTurnMessage: WebSocketMessage = {
        type: 'START_TURN',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startTurnMessage);
      expect(mockWs.messages).toHaveLength(4); // ROOM_CREATED, PLAYER_JOINED, GAME_STARTED, GAME_STATE_UPDATE
    });

    it('should handle END_TURN message', () => {
      // Start turn first
      const startTurnMessage: WebSocketMessage = {
        type: 'START_TURN',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startTurnMessage);

      // End turn
      const endTurnMessage: WebSocketMessage = {
        type: 'END_TURN',
        roomCode,
        playerName: 'host',
        selectedLetter: 'A',
      };
      server.handleMessage(mockWs as any, endTurnMessage);
      expect(mockWs.messages).toHaveLength(5); // ROOM_CREATED, PLAYER_JOINED, GAME_STARTED, GAME_STATE_UPDATE, GAME_STATE_UPDATE
    });

    it('should handle TIME_UP message', () => {
      // Start turn first
      const startTurnMessage: WebSocketMessage = {
        type: 'START_TURN',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startTurnMessage);

      // Time up
      const timeUpMessage: WebSocketMessage = {
        type: 'TIME_UP',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, timeUpMessage);

      // Should have: ROOM_CREATED, PLAYER_JOINED, GAME_STARTED, GAME_STATE_UPDATE, ROUND_END
      expect(mockWs.messages).toHaveLength(5); // Changed from 6 to 5

      // Verify the last message is ROUND_END with correct data
      expect(mockWs.messages[4].type).toBe('ROUND_END');
      expect(mockWs.messages[4].roundNumber).toBe(2);
      expect(mockWs.messages[4].gameState).toBeDefined();
      expect(mockWs.messages[4].gameState.roundActive).toBe(true);

      // Fast-forward timers (no additional messages expected)
      jest.runAllTimers();

      // Still 5 messages - no change after runAllTimers
      expect(mockWs.messages).toHaveLength(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', () => {
      const invalidMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        playerName: 'player1',
      };
      server.handleMessage(mockWs as any, invalidMessage);
      expect(mockWs.messages).toHaveLength(1);
      expect(mockWs.messages[0].type).toBe('ERROR');
      expect(mockWs.messages[0].message).toBe('Room not found');
    });

    it('should handle invalid room code', () => {
      const invalidMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode: 'INVALID',
        playerName: 'player1',
      };
      server.handleMessage(mockWs as any, invalidMessage);
      expect(mockWs.messages).toHaveLength(1);
      expect(mockWs.messages[0].type).toBe('ERROR');
      expect(mockWs.messages[0].message).toBe('Room not found');
    });
  });

  describe('Connection Management', () => {
    let roomCode: string;

    beforeEach(() => {
      // Create room and join player
      const createMessage: WebSocketMessage = {
        type: 'CREATE_ROOM',
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, createMessage);
      roomCode = mockWs.messages[0].roomCode;

      const joinMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player1',
      };
      server.handleMessage(joinWs as any, joinMessage);
    });

    it('should handle player disconnection', () => {
      // Simulate disconnection
      if (mockWs.onclose) {
        mockWs.onclose();
      }

      // Try to join again
      const rejoinMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, rejoinMessage);
      expect(mockWs.messages).toHaveLength(3); // ROOM_CREATED, PLAYER_JOINED, ROOM_JOINED
    });

    it('should handle multiple disconnections', () => {
      const joinWs1 = new MockWebSocket();
      const joinWs2 = new MockWebSocket();

      const joinMessage1: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player1',
      };
      server.handleMessage(joinWs1 as any, joinMessage1);

      const joinMessage2: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player2',
      };
      server.handleMessage(joinWs2 as any, joinMessage2);

      // Simulate disconnections
      server.handleDisconnection(joinWs1 as any);
      server.handleDisconnection(joinWs2 as any);

      // Verify room state
      const room = server.getRoom(roomCode);
      expect(room?.connectedPlayers).toHaveLength(1);
      expect(room?.players).toHaveLength(3);
    });

    it('should handle disconnection during active game', () => {
      // Start game
      const startMessage: WebSocketMessage = {
        type: 'START_GAME',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startMessage);

      // Start turn
      const startTurnMessage: WebSocketMessage = {
        type: 'START_TURN',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startTurnMessage);

      // Simulate disconnection during game
      server.handleDisconnection(joinWs as any);

      // Verify room state persists
      const room = server.getRoom(roomCode);
      expect(room?.gameState.gameStarted).toBe(true);
      expect(room?.connectedPlayers).not.toContain('player1');
      expect(room?.players).toContain('player1'); // Still in player list
    });

    it('should handle reconnection with preserved game state', () => {
      // Start game and make a move
      const startMessage: WebSocketMessage = {
        type: 'START_GAME',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startMessage);

      const startTurnMessage: WebSocketMessage = {
        type: 'START_TURN',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startTurnMessage);

      const endTurnMessage: WebSocketMessage = {
        type: 'END_TURN',
        roomCode,
        playerName: 'host',
        selectedLetter: 'A',
      };
      server.handleMessage(mockWs as any, endTurnMessage);

      // Disconnect player
      server.handleDisconnection(joinWs as any);

      // Reconnect player
      const newWs = new MockWebSocket();
      const rejoinMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player1',
      };
      server.handleMessage(newWs as any, rejoinMessage);

      // Verify game state is preserved - may have multiple messages
      expect(newWs.messages.length).toBeGreaterThanOrEqual(1);
      const roomJoinedMessage = newWs.messages.find(
        (msg) => msg.type === 'ROOM_JOINED'
      );
      expect(roomJoinedMessage).toBeDefined();

      // Check game state from any message that has it
      const gameStateMessage = newWs.messages.find((msg) => msg.gameState);
      expect(gameStateMessage?.gameState?.usedLetters).toContain('A');
      expect(gameStateMessage?.gameState?.gameStarted).toBe(true);
    });

    it('should handle rapid disconnect/reconnect cycles', () => {
      for (let i = 0; i < 5; i++) {
        // Disconnect
        server.handleDisconnection(joinWs as any);
        const room1 = server.getRoom(roomCode);
        expect(room1?.connectedPlayers).not.toContain('player1');

        // Reconnect
        const rejoinMessage: WebSocketMessage = {
          type: 'JOIN_ROOM',
          roomCode,
          playerName: 'player1',
        };
        server.handleMessage(joinWs as any, rejoinMessage);
        const room2 = server.getRoom(roomCode);
        expect(room2?.connectedPlayers).toContain('player1');
      }

      // Verify final state is consistent
      const finalRoom = server.getRoom(roomCode);
      expect(finalRoom?.players).toHaveLength(2);
      expect(finalRoom?.connectedPlayers).toHaveLength(2);
    });

    it('should handle simultaneous disconnections and reconnections', () => {
      const players = ['player2', 'player3', 'player4'];
      const sockets = players.map(() => new MockWebSocket());

      // Add multiple players
      players.forEach((player, index) => {
        const joinMessage: WebSocketMessage = {
          type: 'JOIN_ROOM',
          roomCode,
          playerName: player,
        };
        server.handleMessage(sockets[index] as any, joinMessage);
      });

      // Disconnect all new players
      sockets.forEach((socket) => {
        server.handleDisconnection(socket as any);
      });

      const roomAfterDisconnects = server.getRoom(roomCode);
      expect(roomAfterDisconnects?.connectedPlayers).toHaveLength(2); // host + player1

      // Reconnect all players
      players.forEach((player, index) => {
        const rejoinMessage: WebSocketMessage = {
          type: 'JOIN_ROOM',
          roomCode,
          playerName: player,
        };
        server.handleMessage(sockets[index] as any, rejoinMessage);
      });

      const roomAfterReconnects = server.getRoom(roomCode);
      expect(roomAfterReconnects?.connectedPlayers).toHaveLength(5); // All players reconnected
      expect(roomAfterReconnects?.players).toHaveLength(5);
    });

    it('should maintain WebSocket message integrity during reconnection', () => {
      // Start game
      const startMessage: WebSocketMessage = {
        type: 'START_GAME',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startMessage);

      // Disconnect and reconnect during message flow
      server.handleDisconnection(joinWs as any);

      // Send messages while disconnected (should not crash)
      const startTurnMessage: WebSocketMessage = {
        type: 'START_TURN',
        roomCode,
        playerName: 'host',
      };
      server.handleMessage(mockWs as any, startTurnMessage);

      // Clear previous messages
      joinWs.messages = [];

      // Reconnect
      const rejoinMessage: WebSocketMessage = {
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'player1',
      };
      server.handleMessage(joinWs as any, rejoinMessage);

      // Verify reconnected player receives current state
      expect(joinWs.messages.length).toBeGreaterThanOrEqual(1);
      const gameStateMessage = joinWs.messages.find((msg) => msg.gameState);
      expect(gameStateMessage?.gameState?.isTimerRunning).toBe(true);
    });
  });
});
