// lib/liveKitClient.ts
'use client';

import { Room, RoomOptions } from 'livekit-client';
import { config } from './config';

export class LiveKitClient {
  private static instance: LiveKitClient;
  private room: Room | null = null;

  private constructor() {}

  static getInstance(): LiveKitClient {
    if (!LiveKitClient.instance) {
      LiveKitClient.instance = new LiveKitClient();
    }
    return LiveKitClient.instance;
  }

  async connect(token: string, options?: RoomOptions): Promise<Room> {
    try {
      if (!this.room) {
        this.room = new Room(options);
      }

      await this.room.connect(config.liveKitUrl, token);
      return this.room;
    } catch (error) {
      console.error('Failed to connect to LiveKit:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
  }
}
