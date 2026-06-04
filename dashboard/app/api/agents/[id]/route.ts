import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AGENTS_FILE = path.join(process.cwd(), '..', 'agents.json');
const CONFIG_PATH = path.join(process.cwd(), '..', 'config.py');

function readAgents() {
  return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
}

function writeAgents(agents: any[]) {
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf-8');
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, description, prompt } = await request.json();
    const agents = readAgents();
    const idx = agents.findIndex((a: any) => a.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    agents[idx] = {
      ...agents[idx],
      name: name?.trim() || agents[idx].name,
      description: description?.trim() ?? agents[idx].description,
      prompt: prompt ?? agents[idx].prompt,
    };
    writeAgents(agents);

    // If this is the active agent, sync prompt to config.py immediately
    if (agents[idx].isActive && fs.existsSync(CONFIG_PATH)) {
      let content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      content = content.replace(
        /SYSTEM_PROMPT\s*=\s*"""[\s\S]*?"""/,
        `SYSTEM_PROMPT = """\n${agents[idx].prompt}\n"""`
      );
      fs.writeFileSync(CONFIG_PATH, content, 'utf-8');
    }

    return NextResponse.json({ agent: agents[idx] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let agents = readAgents();
    const agent = agents.find((a: any) => a.id === id);
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    if (agent.isActive) return NextResponse.json({ error: 'Cannot delete the active agent. Activate another agent first.' }, { status: 400 });

    agents = agents.filter((a: any) => a.id !== id);
    writeAgents(agents);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
