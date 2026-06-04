import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), '..', 'config.py');

function extractPrompt(configContent: string): string {
  // Match SYSTEM_PROMPT = """..."""
  const match = configContent.match(/SYSTEM_PROMPT\s*=\s*"""([\s\S]*?)"""/);
  return match ? match[1] : '';
}

export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({ error: 'config.py not found' }, { status: 404 });
    }
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const prompt = extractPrompt(content);
    return NextResponse.json({ prompt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt must be a string' }, { status: 400 });
    }

    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({ error: 'config.py not found' }, { status: 404 });
    }

    let content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    content = content.replace(
      /SYSTEM_PROMPT\s*=\s*"""[\s\S]*?"""/,
      `SYSTEM_PROMPT = """\n${prompt}\n"""`
    );
    fs.writeFileSync(CONFIG_PATH, content, 'utf-8');

    return NextResponse.json({ success: true, message: 'Prompt saved. Restart the agent to apply.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
