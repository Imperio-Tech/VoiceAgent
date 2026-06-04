import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AGENTS_FILE = path.join(process.cwd(), '..', 'agents.json');
const CONFIG_PATH = path.join(process.cwd(), '..', 'config.py');

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agents = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
    const agent = agents.find((a: any) => a.id === id);
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    // Flip active flags
    agents.forEach((a: any) => { a.isActive = a.id === id; });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf-8');

    // Write this agent's prompt into config.py
    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({ error: 'config.py not found' }, { status: 500 });
    }
    let content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    content = content.replace(
      /SYSTEM_PROMPT\s*=\s*"""[\s\S]*?"""/,
      `SYSTEM_PROMPT = """\n${agent.prompt}\n"""`
    );
    fs.writeFileSync(CONFIG_PATH, content, 'utf-8');

    return NextResponse.json({ success: true, agent });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
