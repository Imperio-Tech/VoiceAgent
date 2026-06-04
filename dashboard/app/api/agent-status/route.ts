import { NextResponse } from 'next/server';
import http from 'http';

export async function GET() {
  return new Promise<NextResponse>((resolve) => {
    const req = http.get('http://localhost:8081/', { timeout: 1500 }, () => {
      resolve(NextResponse.json({ running: true }));
    });
    req.on('error', () => resolve(NextResponse.json({ running: false })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ running: false })); });
  });
}
