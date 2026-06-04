import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AGENTS_FILE = path.join(process.cwd(), '..', 'agents.json');
const CONFIG_PATH = path.join(process.cwd(), '..', 'config.py');

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
  isActive: boolean;
}

function readAgents(): AgentProfile[] {
  if (!fs.existsSync(AGENTS_FILE)) {
    // Seed from current config.py on first run
    let prompt = '';
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const match = content.match(/SYSTEM_PROMPT\s*=\s*"""([\s\S]*?)"""/);
      if (match) prompt = match[1].trim();
    }
    const seed: AgentProfile[] = [{
      id: 'imperio-default',
      name: 'Imperio Agent',
      description: 'Default railing inquiry agent for Imperio Railing Systems',
      prompt,
      createdAt: new Date().toISOString(),
      isActive: true,
    }];
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
}

function writeAgents(agents: AgentProfile[]) {
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const agents = readAgents();
    return NextResponse.json({ agents });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, description, prompt } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const agents = readAgents();
    const newAgent: AgentProfile = {
      id: `agent-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      prompt: prompt || '',
      createdAt: new Date().toISOString(),
      isActive: false,
    };
    agents.push(newAgent);
    writeAgents(agents);
    return NextResponse.json({ agent: newAgent });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
