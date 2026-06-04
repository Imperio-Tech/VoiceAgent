import { NextResponse } from 'next/server';
import { roomService, agentDispatch } from '@/lib/server-utils';

export async function GET() {
  try {
    const rooms = await roomService.listRooms();

    const roomData = rooms.map(room => ({
      name: room.name,
      sid: room.sid,
      numParticipants: room.numParticipants,
      creationTime: room.creationTime,
      metadata: room.metadata,
    }));

    return NextResponse.json({ rooms: roomData, count: roomData.length });
  } catch (e: any) {
    return NextResponse.json({ rooms: [], error: e.message }, { status: 500 });
  }
}
