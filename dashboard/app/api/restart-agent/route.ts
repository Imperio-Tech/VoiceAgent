import { NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const AGENT_DIR = path.resolve(process.cwd(), '..');

export async function POST() {
  try {
    // Kill any running agent.py process
    try {
      execSync(
        `powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*agent.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
        { timeout: 6000 }
      );
    } catch { /* none running — ok */ }

    await new Promise(r => setTimeout(r, 1500));

    // Start fresh agent, appending to existing log
    const logPath = path.join(AGENT_DIR, 'agent_out.log');
    const out = fs.openSync(logPath, 'a');
    const child = spawn('python', ['agent.py', 'start'], {
      cwd: AGENT_DIR,
      detached: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
    fs.closeSync(out);

    return NextResponse.json({ success: true, message: 'Agent restarting — ready in ~5s' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
