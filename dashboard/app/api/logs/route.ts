import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_FILES = [
  path.join(process.cwd(), '..', 'agent_stdout.txt'),
  path.join(process.cwd(), '..', 'agent_out.log'),
  path.join(process.cwd(), '..', 'agent_log.txt'),
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tail = parseInt(searchParams.get('tail') || '150', 10);

    let content = '';
    for (const logFile of LOG_FILES) {
      if (fs.existsSync(logFile)) {
        content = fs.readFileSync(logFile, 'utf-8');
        break;
      }
    }

    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(-tail);

    return NextResponse.json({ lines, count: lines.length });
  } catch (e: any) {
    return NextResponse.json({ lines: [], error: e.message }, { status: 500 });
  }
}
