'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import { EtheralBackground } from '@/components/ui/etheral-shadow';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
  isActive: boolean;
}

type TabId =
  | 'stats' | 'single-call' | 'batch-call' | 'campaigns'
  | 'appointments' | 'call-logs' | 'crm'
  | 'agents' | 'settings' | 'logs' | 'setup';

interface Lead {
  buyerType: string; requirementType: string; projectStage: string;
  quantity: string; urgency: string; location: string;
}
interface CsvRow {
  phone: string; leadName: string; businessName: string; serviceType: string;
}
interface Classification {
  classification: 'Hot' | 'Warm' | 'Cold' | 'Unknown';
  confidence?: string;
  reason?: string;
  key_points?: string[];
  follow_up_priority?: string;
  buyer_type?: string;
  requirement?: string;
  location?: string;
  urgency?: string;
}
interface Transcript {
  id: string; phone: string; date: string; time: string;
  datetime: string; status: 'completed' | 'incomplete';
  preview: string; lineCount: number; lead: Lead;
  classification?: Classification | null;
}

// ─── Nav config ────────────────────────────────────────────────────────────────

const NAV: { id: TabId; label: string; alert?: boolean }[] = [
  { id: 'stats',        label: 'Stats' },
  { id: 'single-call',  label: 'Single Call' },
  { id: 'batch-call',   label: 'Batch Call' },
  { id: 'campaigns',    label: 'Campaigns' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'call-logs',    label: 'Call Logs' },
  { id: 'crm',          label: 'CRM' },
  { id: 'agents',       label: 'Agents' },
  { id: 'settings',     label: 'Settings' },
  { id: 'logs',         label: 'Logs', alert: true },
  { id: 'setup',        label: 'Setup' },
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

function Badge({ status }: { status: 'completed' | 'incomplete' }) {
  return status === 'completed'
    ? <span className="badge-complete">Complete</span>
    : <span className="badge-partial">Partial</span>;
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
      {text}{required && <span style={{ color: 'var(--destructive)', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Label text={label} required={required} />
      {children}
    </div>
  );
}

function AlertBox({ type, children }: { type: 'success' | 'error'; children: React.ReactNode }) {
  const isOk = type === 'success';
  return (
    <div style={{
      padding: '11px 15px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
      background: isOk ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)',
      color: isOk ? '#4ade80' : '#f87171',
      border: `1px solid ${isOk ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.2)'}`,
      backdropFilter: 'blur(8px)',
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 20 }}>
      {children}
    </p>
  );
}

function Spinner() {
  return <span className="spin" style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />;
}

// ─── ANIMATED HELPERS ──────────────────────────────────────────────────────────

function AnimatedNumber({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    const dur = 1100;
    const s = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - s) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(e * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to]);
  return <>{val}{suffix}</>;
}

function DonutChart({ value, max, color }: { value: number; max: number; color: string }) {
  const [progress, setProgress] = useState(0);
  const pct = max > 0 ? value / max : 0;
  const SIZE = 130, SW = 11, R = (SIZE - SW) / 2;
  const circ = 2 * Math.PI * R;
  useEffect(() => { const t = setTimeout(() => setProgress(pct), 120); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
          stroke={color} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${color}99)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
          <AnimatedNumber to={Math.round(pct * 100)} suffix="%" />
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginTop: 4 }}>Success</span>
      </div>
    </div>
  );
}

function DayBars({ data }: { data: { label: string; total: number; done: number }[] }) {
  const [up, setUp] = useState(false);
  const max = Math.max(...data.map(d => d.total), 1);
  useEffect(() => { const t = setTimeout(() => setUp(true), 250); return () => clearTimeout(t); }, []);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1 }}>
            <div style={{
              borderRadius: '3px 3px 0 0', background: 'rgba(129,140,248,0.22)',
              height: up ? `${((d.total - d.done) / max) * 60}px` : '0px',
              transition: `height 0.6s ${0.05 + i * 0.055}s cubic-bezier(0.16,1,0.3,1)`,
            }} />
            <div style={{
              borderRadius: d.done === d.total && d.done > 0 ? '3px 3px 0 0' : '0',
              background: 'linear-gradient(180deg, #4ade80 0%, rgba(34,197,94,0.45) 100%)',
              boxShadow: d.done > 0 ? '0 0 10px rgba(34,197,94,0.35)' : 'none',
              height: up ? `${(d.done / max) * 60}px` : '0px',
              transition: `height 0.6s ${i * 0.055}s cubic-bezier(0.16,1,0.3,1)`,
              minHeight: d.done > 0 ? 3 : 0,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: 'var(--text-muted)' }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── STATS TAB ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const [data, setData] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/transcripts').then(r => r.json()).then(d => { setData(d.transcripts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>;

  const total     = data.length;
  const completed = data.filter(t => t.status === 'completed').length;
  const partial   = total - completed;
  const rate      = total ? Math.round((completed / total) * 100) : 0;
  const unique    = new Set(data.map(t => t.phone)).size;
  const cities    = Array.from(new Set(data.map(t => t.lead.location).filter(l => l && l !== '—')));
  const rateColor = rate >= 70 ? '#4ade80' : rate >= 40 ? '#fbbf24' : '#f87171';

  // Last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const day = data.filter(t => t.date === ymd);
    return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), total: day.length, done: day.filter(t => t.status === 'completed').length };
  });

  const cards = [
    { label: 'Total Calls',    to: total,     color: '#f1f5f9' },
    { label: 'Completed',      to: completed, color: '#4ade80' },
    { label: 'Partial',        to: partial,   color: '#fbbf24' },
    { label: 'Unique Callers', to: unique,    color: '#818cf8' },
  ];

  return (
    <div className="fadein" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>Overview</SectionTitle>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {cards.map(c => (
          <div key={c.label} className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: '18px 20px' }}>
            {/* Top accent line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${c.color}66, transparent)` }} />
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>{c.label}</p>
            <p style={{ fontSize: 34, fontWeight: 700, color: c.color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              <AnimatedNumber to={c.to} />
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '162px 1fr', gap: 12 }}>
        {/* Donut */}
        <div className="card" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <DonutChart value={completed} max={total} color={rateColor} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
              {completed} / {total} calls
            </p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Calls — Last 7 Days</p>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80' }} /> Completed
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(129,140,248,0.4)' }} /> Partial
              </div>
            </div>
          </div>
          <DayBars data={last7} />
        </div>
      </div>

      {/* ── Cities ── */}
      {cities.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>Cities Covered ({cities.length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cities.map(c => (
              <span key={c} style={{ padding: '4px 11px', fontSize: 12, background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 999, color: '#818cf8' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent calls ── */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 14 }}>Recent Calls</p>
        {data.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No calls yet.</p> : (
          <table>
            <thead><tr><th>Phone</th><th>Date / Time</th><th>Status</th><th>City</th></tr></thead>
            <tbody>
              {data.slice(0, 10).map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{t.phone}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.datetime}</td>
                  <td><Badge status={t.status} /></td>
                  <td style={{ color: '#86efac', fontWeight: 600 }}>{t.lead.location !== '—' ? t.lead.location : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── SINGLE CALL TAB ───────────────────────────────────────────────────────────

function SingleCallTab({ agentOnline }: { agentOnline: boolean | null }) {
  const [phone, setPhone] = useState('');
  const [leadName, setLeadName] = useState('');
  const [bizName, setBizName] = useState('Imperio Railing Systems');
  const [svcType, setSvcType] = useState('railing-inquiry');
  const [showMore, setShowMore] = useState(false);
  const [override, setOverride] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'calling' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('calling'); setMsg('');
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, leadName, businessName: bizName, serviceType: svcType, overridePrompt: override, customPrompt }),
      });
      const d = await res.json();
      if (res.ok) { setStatus('ok'); setMsg(`Call dispatched to ${d.phone} — your phone will ring in a few seconds.`); setPhone(''); setLeadName(''); }
      else { setStatus('err'); setMsg(d.error || 'Dispatch failed'); }
    } catch (e: any) { setStatus('err'); setMsg(e.message); }
  };

  return (
    <div className="fadein" style={{ maxWidth: 560 }}>
      <SectionTitle>Single Outbound Call</SectionTitle>

      {/* Agent offline warning */}
      {agentOnline === false && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 18,
          background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8,
          fontSize: 13, color: '#f87171',
        }}>
          <span style={{ fontSize: 15 }}>⚠</span>
          <span>Agent is offline. Click <strong>↻ Start Agent</strong> in the header to start it, then wait 5 seconds.</span>
        </div>
      )}

      <div className="card" style={{ padding: 28 }}>
        <form onSubmit={submit}>

          {/* Phone number — big and prominent */}
          <div style={{ marginBottom: 20 }}>
            <Label text="Phone Number" required />
            <input
              type="tel"
              placeholder="+919876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              autoFocus
              style={{ fontSize: 18, padding: '12px 16px', letterSpacing: '0.02em' }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Include country code — e.g. +91 for India</p>
          </div>

          {/* Optional fields toggle */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, textDecoration: 'underline' }}
          >
            {showMore ? '▲ Hide optional fields' : '▼ Add lead details (optional)'}
          </button>

          {showMore && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <Field label="Lead Name">
                <input type="text" placeholder="e.g. Rahul Sharma" value={leadName} onChange={e => setLeadName(e.target.value)} />
              </Field>
              <Field label="Service Type">
                <select value={svcType} onChange={e => setSvcType(e.target.value)}>
                  <option value="railing-inquiry">Railing Inquiry</option>
                  <option value="glass-railing">Glass Railing</option>
                  <option value="staircase-railing">Staircase Railing</option>
                  <option value="balcony-railing">Balcony Railing</option>
                </select>
              </Field>
              <Field label="Business Name">
                <input type="text" value={bizName} onChange={e => setBizName(e.target.value)} />
              </Field>
              <div />

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: '#22c55e', cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    Override System Prompt for This Call
                  </span>
                </label>
                {override && (
                  <div style={{ marginTop: 12 }}>
                    <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                      placeholder="Enter custom instructions…" rows={4} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Call button */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18 }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={status === 'calling' || !phone.trim()}
              style={{ width: '100%', padding: '12px 20px', fontSize: 15, justifyContent: 'center' }}
            >
              {status === 'calling' ? <><Spinner />Connecting…</> : <>▶ Call {phone || 'number'}</>}
            </button>
            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '-0.01em' }}>
              Vobiz SIP · Gemini 2.5 Flash · Sarvam Kavya
            </p>
          </div>

          {/* Result */}
          {msg && <div style={{ marginTop: 14 }}><AlertBox type={status === 'ok' ? 'success' : 'error'}>{msg}</AlertBox></div>}
        </form>
      </div>
    </div>
  );
}

// ─── BATCH CALL TAB ────────────────────────────────────────────────────────────

function BatchCallTab() {
  const [file, setFile] = useState<File | null>(null);
  const [delay, setDelay] = useState('3');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [agentProfile, setAgentProfile] = useState('default');
  const [parsed, setParsed] = useState<CsvRow[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'err'>('idle');
  const [results, setResults] = useState<any[]>([]);

  const parseCSV = () => {
    if (!file) return;
    setParseError(''); setParsed(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || '';
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) { setParseError('Empty file'); return; }

        const first = lines[0].toLowerCase();
        const hasHeader = first.includes('phone') || first.includes('lead') || first.includes('business');
        const dataLines = hasHeader ? lines.slice(1) : lines;

        let pi = 0, li = 1, bi = 2, si = 3;
        if (hasHeader) {
          const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
          const fi = (a: string[]) => { const i = hdrs.findIndex(h => a.includes(h)); return i >= 0 ? i : -1; };
          const p = fi(['phone', 'phone_number', 'mobile', 'number']); if (p >= 0) pi = p;
          const l = fi(['lead_name', 'leadname', 'name', 'contact']); if (l >= 0) li = l;
          const b = fi(['business_name', 'businessname', 'business', 'company']); if (b >= 0) bi = b;
          const s = fi(['service_type', 'servicetype', 'service', 'type']); if (s >= 0) si = s;
        }

        const rows: CsvRow[] = dataLines
          .map(line => {
            const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
            return { phone: parts[pi] || '', leadName: parts[li] || '', businessName: parts[bi] || '', serviceType: parts[si] || '' };
          })
          .filter(r => r.phone);

        if (!rows.length) { setParseError('No valid rows found. Check that phone numbers are in the first column.'); return; }
        setParsed(rows);
      } catch (err: any) { setParseError('Parse error: ' + err.message); }
    };
    reader.readAsText(file);
  };

  const startBatch = async () => {
    if (!parsed?.length || status === 'running') return;
    setStatus('running'); setResults([]);
    const delayBetween = Math.max(1, parseInt(delay) || 3) * 1000;
    const collected: any[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      try {
        const res = await fetch('/api/dispatch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: row.phone,
            leadName: row.leadName,
            businessName: row.businessName,
            serviceType: row.serviceType,
            ...(useCustomPrompt && customPrompt ? { overridePrompt: true, customPrompt } : {}),
          }),
        });
        const d = await res.json();
        const entry = { phone: row.phone, status: res.ok ? 'dispatched' : 'failed', error: d.error };
        collected.push(entry);
        setResults([...collected]);
      } catch (e: any) {
        collected.push({ phone: row.phone, status: 'failed', error: e.message });
        setResults([...collected]);
      }
      if (i < parsed.length - 1) await new Promise(r => setTimeout(r, delayBetween));
    }
    setStatus('done');
  };

  const ok = results.filter(r => r.status === 'dispatched').length;
  const fail = results.filter(r => r.status === 'failed').length;

  return (
    <div className="fadein" style={{ maxWidth: 740 }}>
      <SectionTitle>Batch Call — CSV Upload</SectionTitle>

      {/* Info card */}
      <div style={{
        padding: '13px 17px', marginBottom: 20,
        background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 8, fontSize: 13, lineHeight: 1.8, backdropFilter: 'blur(8px)',
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>CSV header: </span>
        <code style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 12 }}>phone,lead_name,business_name,service_type</code>
        <br />
        <span style={{ color: 'var(--text-secondary)' }}>Phones must include country code: </span>
        <code style={{ color: '#86efac', fontFamily: 'monospace', fontSize: 12 }}>+919876543210</code>
      </div>

      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Custom prompt toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={useCustomPrompt} onChange={e => setUseCustomPrompt(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)' }}>
            Use a Custom Prompt for the Entire Batch
          </span>
        </label>

        {useCustomPrompt && (
          <Field label="Custom Prompt">
            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Enter custom instructions for all calls in this batch…" rows={4} />
          </Field>
        )}

        {/* Agent Profile */}
        <div style={{ maxWidth: 320 }}>
          <Field label="Agent Profile">
            <select value={agentProfile} onChange={e => setAgentProfile(e.target.value)}>
              <option value="default">— Use Active Agent —</option>
              <option value="anushka">Anushka — Imperio (Active)</option>
            </select>
          </Field>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* CSV file + delay side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, alignItems: 'end' }}>
          <Field label="CSV File">
            <input
              type="file" accept=".csv,.txt"
              onChange={e => { setFile(e.target.files?.[0] || null); setParsed(null); setResults([]); setStatus('idle'); setParseError(''); }}
              style={{ padding: '7px 10px', cursor: 'pointer' }}
            />
          </Field>
          <Field label="Delay (Seconds)">
            <input type="number" min="1" max="60" value={delay} onChange={e => setDelay(e.target.value)} />
          </Field>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button" onClick={parseCSV} disabled={!file}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 20px',
              background: file ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              color: file ? '#818cf8' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, borderRadius: 7, border: `1px solid ${file ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.08)'}`,
              cursor: file ? 'pointer' : 'not-allowed', transition: 'all 0.18s', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}
          >
            📋 Parse CSV
          </button>
          <button
            type="button" onClick={startBatch}
            disabled={!parsed?.length || status === 'running'}
            className="btn-primary"
          >
            {status === 'running' ? <><Spinner />Launching…</> : '▶ Start Batch'}
          </button>
          {parsed && !parseError && (
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>✓ {parsed.length} rows ready</span>
          )}
        </div>

        {parseError && <AlertBox type="error">{parseError}</AlertBox>}

        {/* Parsed preview table */}
        {parsed && parsed.length > 0 && (
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 16px', background: 'rgba(0,0,0,0.2)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-muted)' }}>Preview</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{parsed.length} row{parsed.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Phone</th><th>Lead Name</th><th>Business</th><th>Service Type</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.phone}</td>
                      <td>{row.leadName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.businessName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.serviceType || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    </tr>
                  ))}
                  {parsed.length > 50 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0' }}>…and {parsed.length - 50} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18 }}>
            <p style={{ fontSize: 12, marginBottom: 10 }}>
              <span style={{ color: '#4ade80', fontWeight: 600 }}>{ok} dispatched</span>
              {fail > 0 && <span style={{ color: '#f87171', marginLeft: 12, fontWeight: 600 }}>{fail} failed</span>}
            </p>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, fontSize: 12,
                }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{r.phone}</span>
                  {r.status === 'dispatched'
                    ? <span style={{ color: '#4ade80' }}>✓ Sent</span>
                    : <span style={{ color: '#f87171' }}>✗ {r.error || 'Failed'}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── CALL LOGS TAB ─────────────────────────────────────────────────────────────

function CallLogsTab() {
  const [list, setList] = useState<Transcript[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/transcripts').then(r => r.json()).then(d => { setList(d.transcripts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const view = async (id: string) => {
    setSelected(id);
    const res = await fetch(`/api/transcripts/${encodeURIComponent(id)}`);
    const d = await res.json();
    setContent(d.content || 'Could not load.');
  };

  const filtered = list.filter(t => !search || t.phone.includes(search) || t.datetime.includes(search));

  return (
    <div className="fadein">
      <SectionTitle>Call Logs</SectionTitle>
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 210px)' }}>
        {/* List panel */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Search phone or date…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loading && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>Loading…</p>}
            {!loading && filtered.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>No logs found.</p>}
            {filtered.map(t => (
              <button key={t.id} onClick={() => view(t.id)} style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${selected === t.id ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)'}`,
                background: selected === t.id ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer', color: 'inherit', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: selected === t.id ? '#4ade80' : 'var(--text-primary)' }}>{t.phone}</span>
                  <Badge status={t.status} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.datetime}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content panel */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selected
            ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>← Select a call to view transcript</div>
            : <pre style={{ flex: 1, overflow: 'auto', padding: 20, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</pre>
          }
        </div>
      </div>
    </div>
  );
}

// ─── CRM TAB ───────────────────────────────────────────────────────────────────

const CLS_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  Hot:     { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.22)',   dot: '#ef4444' },
  Warm:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)',  dot: '#f59e0b' },
  Cold:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)',  dot: '#60a5fa' },
  Unknown: { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', dot: '#94a3b8' },
};

function ClsBadge({ cls }: { cls: string }) {
  const m = CLS_META[cls] ?? CLS_META.Unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: m.bg, border: `1px solid ${m.border}`, color: m.color,
      letterSpacing: '0.03em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {cls}
    </span>
  );
}

function PriorityChip({ priority }: { priority?: string }) {
  if (!priority) return null;
  const label = priority.replace(/_/g, ' ');
  const color = priority === 'immediate' ? '#4ade80' : priority === 'within_week' ? '#fbbf24' : '#94a3b8';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </span>
  );
}

function CRMTab() {
  const [leads, setLeads] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'Hot' | 'Warm' | 'Cold' | 'Unknown'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/transcripts')
      .then(r => r.json())
      .then(d => { setLeads(d.transcripts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getCls = (l: Transcript) => l.classification?.classification ?? 'Unknown';

  const counts = {
    all:     leads.length,
    Hot:     leads.filter(l => getCls(l) === 'Hot').length,
    Warm:    leads.filter(l => getCls(l) === 'Warm').length,
    Cold:    leads.filter(l => getCls(l) === 'Cold').length,
    Unknown: leads.filter(l => getCls(l) === 'Unknown' || !l.classification).length,
  };

  const shown = filter === 'all' ? leads : leads.filter(l => getCls(l) === filter);
  const classified = leads.filter(l => l.classification).length;

  return (
    <div className="fadein" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>CRM — Lead Intelligence</SectionTitle>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {(['Hot', 'Warm', 'Cold', 'Unknown'] as const).map(cls => {
          const m = CLS_META[cls];
          return (
            <div
              key={cls}
              onClick={() => setFilter(f => f === cls ? 'all' : cls)}
              className="stat-card"
              style={{
                padding: '16px 18px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                border: `1px solid ${filter === cls ? m.border : 'rgba(255,255,255,0.06)'}`,
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${m.color}55, transparent)` }} />
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: m.color, marginBottom: 8 }}>
                {cls} Leads
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, color: m.color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                <AnimatedNumber to={counts[cls]} />
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Odoo status banner ── */}
      <div style={{
        padding: '10px 16px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
        background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.15)',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 14 }}>🔗</span>
        <span>
          <strong style={{ color: '#818cf8' }}>Odoo CRM</strong> — {classified} of {leads.length} calls classified.{' '}
          Transcripts push automatically after each call once you add <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY</code> to <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>.env</code>.
        </span>
      </div>

      {/* ── Filter pills ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'Hot', 'Warm', 'Cold', 'Unknown'] as const).map(f => {
          const m = f === 'all' ? null : CLS_META[f];
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 999,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              background: active ? (m ? m.bg : 'rgba(255,255,255,0.06)') : 'transparent',
              color: active ? (m ? m.color : '#f1f5f9') : 'var(--text-muted)',
              border: `1px solid ${active ? (m ? m.border : 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.07)'}`,
            }}>
              {f === 'all' ? `All (${counts.all})` : `${f} (${counts[f]})`}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      {loading
        ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading leads…</p>
        : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {['Phone', 'Date', 'Classification', 'Reason', 'Follow-up', 'Buyer', 'City', 'Call Status'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0
                    ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No leads found.</td></tr>
                    : shown.map(l => {
                        const cls = getCls(l);
                        const reason = l.classification?.reason ?? '';
                        const fp = l.classification?.follow_up_priority;
                        const buyer = l.classification?.buyer_type || l.lead.buyerType;
                        const city = l.classification?.location || l.lead.location;
                        const isExpanded = expanded === l.id;
                        return (
                          <React.Fragment key={l.id}>
                            <tr
                              onClick={() => setExpanded(isExpanded ? null : l.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.phone}</td>
                              <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 12 }}>{l.datetime}</td>
                              <td><ClsBadge cls={cls} /></td>
                              <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                                {reason || '—'}
                              </td>
                              <td><PriorityChip priority={fp} /></td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{buyer !== '—' ? buyer : ''}</td>
                              <td style={{ fontWeight: 600, color: '#86efac', fontSize: 12 }}>{city !== '—' ? city : ''}</td>
                              <td><Badge status={l.status} /></td>
                            </tr>
                            {isExpanded && l.classification?.key_points && l.classification.key_points.length > 0 && (
                              <tr>
                                <td colSpan={8} style={{ background: 'rgba(129,140,248,0.04)', padding: '10px 16px' }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>Key Points</p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {l.classification.key_points.map((pt, i) => (
                                      <span key={i} style={{ fontSize: 12, padding: '3px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, color: 'var(--text-secondary)' }}>
                                        {pt}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div>
  );
}

// ─── CAMPAIGNS TAB ─────────────────────────────────────────────────────────────

function CampaignsTab() {
  return (
    <div className="fadein" style={{ maxWidth: 560 }}>
      <SectionTitle>Campaigns</SectionTitle>
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 14, filter: 'grayscale(0.3)' }}>📋</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Campaign Management</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>Create named campaigns with contact lists, call schedules, and performance goals.<br />Use <strong style={{ color: 'var(--text-primary)' }}>Batch Call</strong> to run a campaign right now.</p>
      </div>
    </div>
  );
}

// ─── APPOINTMENTS TAB ──────────────────────────────────────────────────────────

function AppointmentsTab() {
  return (
    <div className="fadein" style={{ maxWidth: 560 }}>
      <SectionTitle>Appointments</SectionTitle>
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 14, filter: 'grayscale(0.3)' }}>📅</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Appointment Scheduler</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>Schedule follow-up calls and meetings with qualified leads automatically.<br />Connect your calendar to get started.</p>
      </div>
    </div>
  );
}

// ─── AGENTS TAB ────────────────────────────────────────────────────────────────

function AgentModal({ mode, agent, onClose, onSave }: {
  mode: 'create' | 'edit';
  agent?: AgentProfile;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [prompt, setPrompt] = useState(agent?.prompt || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    try {
      const url = mode === 'create' ? '/api/agents' : `/api/agents/${agent!.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, prompt }),
      });
      const d = await res.json();
      if (res.ok) { onSave(); }
      else { setErr(d.error || 'Save failed'); }
    } catch { setErr('Network error'); }
    setSaving(false);
  };

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#070e1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
        width: '100%', maxWidth: 700, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,197,94,0.05)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {mode === 'create' ? 'New Agent' : `Edit — ${agent?.name}`}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Agent Name" required>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Birthday Party Planner, Event Booking Agent…"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief note about what this agent does (optional)"
            />
          </Field>
          <Field label="System Prompt">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={20}
              placeholder="Enter the full system prompt for this agent. This is what the AI will use as instructions during every call…"
              spellCheck={false}
              style={{
                fontFamily: 'monospace', fontSize: 12, lineHeight: 1.65,
                resize: 'vertical', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: 14,
              }}
            />
          </Field>
          {err && <AlertBox type="error">{err}</AlertBox>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="btn-primary"
            style={{ padding: '8px 22px' }}
          >
            {saving ? <><Spinner />{mode === 'create' ? 'Creating…' : 'Saving…'}</> : mode === 'create' ? 'Create Agent' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentsTab() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; agent?: AgentProfile } | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => { setAgents(d.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async (id: string) => {
    setActivating(id); setMsg('');
    try {
      const res = await fetch(`/api/agents/${id}/activate`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        setMsgType('success');
        setMsg(`Agent activated. Restart the agent process to apply the new prompt.`);
        load();
      } else {
        setMsgType('error');
        setMsg(d.error || 'Failed to activate');
      }
    } catch { setMsgType('error'); setMsg('Network error'); }
    setActivating(null);
  };

  const deleteAgent = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) { load(); }
      else { const d = await res.json(); setMsgType('error'); setMsg(d.error || 'Delete failed'); }
    } catch { setMsgType('error'); setMsg('Network error'); }
    setDeleting(null);
  };

  const activeAgent = agents.find(a => a.isActive);

  return (
    <div className="fadein" style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <SectionTitle>Agent Profiles</SectionTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -14, lineHeight: 1.6 }}>
            Create multiple AI agent personas with different prompts. Activate one to use it for all calls.
            {activeAgent && (
              <span style={{ color: '#4ade80', marginLeft: 6 }}>Active: <strong>{activeAgent.name}</strong></span>
            )}
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="btn-primary"
          style={{ padding: '8px 18px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          + New Agent
        </button>
      </div>

      {msg && <div style={{ marginBottom: 16 }}><AlertBox type={msgType}>{msg}</AlertBox></div>}

      {loading && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading agents…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {agents.map(agent => (
          <div
            key={agent.id}
            style={{
              padding: '18px 22px', borderRadius: 12,
              border: agent.isActive ? '1px solid rgba(34,197,94,0.28)' : '1px solid rgba(255,255,255,0.07)',
              background: agent.isActive ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              {/* Left: info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: agent.description ? 6 : 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</span>
                  {agent.isActive && (
                    <span style={{
                      padding: '2px 9px', fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      background: 'rgba(34,197,94,0.12)', color: '#4ade80',
                      border: '1px solid rgba(34,197,94,0.25)', borderRadius: 999,
                    }}>
                      Active
                    </span>
                  )}
                </div>
                {agent.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{agent.description}</p>
                )}
                {agent.prompt ? (
                  <p style={{
                    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 540, lineHeight: 1.5,
                  }}>
                    {agent.prompt.replace(/\n/g, ' ').substring(0, 140)}
                    {agent.prompt.length > 140 ? '…' : ''}
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No prompt set</p>
                )}
              </div>

              {/* Right: actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                {!agent.isActive && (
                  <button
                    onClick={() => activate(agent.id)}
                    disabled={activating === agent.id}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                      background: 'rgba(34,197,94,0.08)',
                      color: activating === agent.id ? 'var(--text-muted)' : '#4ade80',
                      border: '1px solid rgba(34,197,94,0.22)',
                      cursor: activating === agent.id ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.18s', fontFamily: 'inherit',
                    }}
                  >
                    {activating === agent.id ? 'Activating…' : '▶ Activate'}
                  </button>
                )}
                <button
                  onClick={() => setModal({ mode: 'edit', agent })}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
                >
                  Edit
                </button>
                {!agent.isActive && (
                  <button
                    onClick={() => deleteAgent(agent.id, agent.name)}
                    disabled={deleting === agent.id}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                      background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d33',
                      cursor: deleting === agent.id ? 'not-allowed' : 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && agents.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
            No agents yet. Click <strong style={{ color: 'var(--text-secondary)' }}>+ New Agent</strong> to create one.
          </div>
        )}
      </div>

      {modal && (
        <AgentModal
          mode={modal.mode}
          agent={modal.agent}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── LOGS TAB ──────────────────────────────────────────────────────────────────

function LogsTab() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetch_ = useCallback(() => {
    fetch('/api/logs?tail=200').then(r => r.json()).then(d => { setLines(d.lines || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { if (!auto) return; const i = setInterval(fetch_, 3000); return () => clearInterval(i); }, [auto, fetch_]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  const cls = (l: string) => {
    if (/error|exception|failed|traceback/i.test(l)) return 'log-error';
    if (/warn/i.test(l)) return 'log-warn';
    if (/INFO|info/i.test(l)) return 'log-info';
    if (/DEBUG|debug/i.test(l)) return 'log-debug';
    return 'log-default';
  };

  return (
    <div className="fadein" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SectionTitle>Agent Logs</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} style={{ accentColor: '#22c55e', cursor: 'pointer' }} />
            Auto-refresh (3s)
          </label>
          <button onClick={fetch_} className="btn-ghost">↻ Refresh</button>
        </div>
      </div>
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading
          ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading logs…</div>
          : lines.length === 0
            ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No logs found. Make sure the agent is running.</div>
            : <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
                {lines.map((l, i) => <div key={i} className={cls(l)}>{l}</div>)}
                <div ref={bottomRef} />
              </div>
        }
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const groups = [
    { name: 'LiveKit', items: [
      ['URL', 'wss://voiceagent-0qb5gof7.livekit.cloud'],
      ['API Key', 'APIXna4Uxrk2eFM'],
      ['Agent Name', 'outbound-caller'],
    ]},
    { name: 'SIP / Telephony', items: [
      ['Provider', 'Vobiz'],
      ['Trunk ID', 'ST_mtegh2QPGFCo'],
    ]},
    { name: 'AI Stack', items: [
      ['LLM', 'Gemini 2.5 Flash (gemini-2.5-flash)'],
      ['TTS', 'Sarvam · bulbul:v3-beta · Voice: Kavya'],
      ['STT', 'Sarvam · saaras:v3 · Mode: codemix'],
      ['VAD', 'Silero (real-time barge-in, 0.2s threshold)'],
    ]},
    { name: 'Agent', items: [
      ['Name', 'Anushka'],
      ['Language', 'English (switches to Hindi on request)'],
      ['Company', 'Imperio Railing Systems'],
      ['Questions', '6 lead qualification questions'],
    ]},
  ];

  return (
    <div className="fadein" style={{ maxWidth: 640 }}>
      <SectionTitle>Configuration</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map(g => (
          <div key={g.name} className="card" style={{ padding: '18px 22px' }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-muted)', marginBottom: 14 }}>{g.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {g.items.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', maxWidth: 340, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>To change keys, edit <code style={{ color: '#22c55e' }}>LIvekitAIVoice/.env</code> and restart the agent.</p>
      </div>
    </div>
  );
}

// ─── SETUP TAB ─────────────────────────────────────────────────────────────────

function SetupTab() {
  const steps = [
    { done: true, title: 'LiveKit project created', detail: 'wss://voiceagent-0qb5gof7.livekit.cloud' },
    { done: true, title: 'Vobiz SIP trunk configured', detail: 'Trunk ID: ST_mtegh2QPGFCo' },
    { done: true, title: 'Sarvam API connected', detail: 'TTS: bulbul:v3-beta  ·  STT: saaras:v3' },
    { done: true, title: 'Groq LLM connected', detail: 'llama-3.3-70b-versatile' },
    { done: true, title: 'Agent deployed', detail: 'python agent.py start  →  outbound-caller worker' },
    { done: true, title: 'Barge-in (Silero VAD) enabled', detail: '0.2s interruption threshold' },
    { done: true, title: 'Dashboard running', detail: 'Next.js on localhost:3000' },
  ];

  return (
    <div className="fadein" style={{ maxWidth: 520 }}>
      <SectionTitle>Setup Checklist</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
            <span style={{ color: s.done ? '#4ade80' : 'var(--text-muted)', fontSize: 15, fontWeight: 700, marginTop: 1 }}>{s.done ? '✓' : '○'}</span>
            <div>
              <p style={{ fontSize: 13, color: s.done ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>{s.title}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 8, fontSize: 12, color: '#86efac', lineHeight: 1.6 }}>
        All systems operational. Use <strong>Single Call</strong> or <strong>Batch Call</strong> to start.
      </div>
    </div>
  );
}

// ─── ROOT DASHBOARD ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<TabId>('single-call');
  const [clock, setClock] = useState('');
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const check = () =>
      fetch('/api/agent-status').then(r => r.json()).then(d => setAgentOnline(d.running)).catch(() => setAgentOnline(false));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const restartAgent = async () => {
    setRestarting(true);
    try {
      await fetch('/api/restart-agent', { method: 'POST' });
      await new Promise(r => setTimeout(r, 5000));
      const d = await fetch('/api/agent-status').then(r => r.json());
      setAgentOnline(d.running);
    } finally {
      setRestarting(false);
    }
  };

  useEffect(() => {
    // Entrance sequence
    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } });
    tl.from('.g-badge',   { y: 14,  autoAlpha: 0, duration: 0.55, delay: 0.15 })
      .from('.g-title',   { y: 32,  autoAlpha: 0, duration: 0.82 }, '-=0.35')
      .from('.g-sub',     { y: 20,  autoAlpha: 0, duration: 0.6  }, '-=0.5')
      .from('.g-stat',    { y: 14,  autoAlpha: 0, stagger: 0.09  }, '-=0.45')
      .from('.g-header',  { y: -28, autoAlpha: 0, duration: 0.6  }, '-=0.85')
      .from('.g-nav',     { y: -10, autoAlpha: 0, duration: 0.45 }, '-=0.4')
      .from('.g-content', { y: 18,  autoAlpha: 0, duration: 0.6  }, '-=0.35');

    // Pulsing glow behind sidebar text
    const glow = gsap.to('.g-glow', {
      scale: 1.28, opacity: 0.95,
      duration: 3.5, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });

    // GSAP plasma blob motion — organic drifting
    const b1 = gsap.to('.a-b1', {
      x: '20%', y: '16%', scale: 1.32,
      duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
    const b2 = gsap.to('.a-b2', {
      x: '-16%', y: '-13%', scale: 1.28,
      duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2,
    });
    const b3 = gsap.to('.a-b3', {
      x: '-14%', y: '10%', scale: 1.22,
      duration: 10, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 4,
    });

    return () => { tl.kill(); glow.kill(); b1.kill(); b2.kill(); b3.kill(); };
  }, []);

  const TAB_MAP: Record<TabId, React.ReactNode> = {
    'stats':        <StatsTab />,
    'single-call':  <SingleCallTab agentOnline={agentOnline} />,
    'batch-call':   <BatchCallTab />,
    'campaigns':    <CampaignsTab />,
    'appointments': <AppointmentsTab />,
    'call-logs':    <CallLogsTab />,
    'crm':          <CRMTab />,
    'agents':       <AgentsTab />,
    'settings':     <SettingsTab />,
    'logs':         <LogsTab />,
    'setup':        <SetupTab />,
  };

  const agentColor = agentOnline === null ? 'var(--text-muted)' : agentOnline ? '#22c55e' : '#f87171';
  const agentGlow  = agentOnline ? '0 0 10px rgba(34,197,94,0.6)' : 'none';
  const agentLabel = agentOnline === null ? 'Checking…' : agentOnline ? 'Agent Online' : 'Agent Offline';

  return (
    <div ref={root} style={{ display: 'flex', minHeight: '100vh', position: 'relative', background: '#0a0a1a', overflow: 'hidden' }}>

      {/* ── Etheral shadow background — z-index 0, behind everything ── */}
      <EtheralBackground />

      {/* ── Plasma aurora — blobs driven by GSAP ── */}
      <div className="dash-aurora">
        <span className="a-b1" />
        <span className="a-b2" />
        <span className="a-b3" />
      </div>

      {/* ── Left branding sidebar ── */}
      <aside style={{
        width: 252, flexShrink: 0, position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 28px 40px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10,8,28,0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        {/* Ambient glow blob */}
        <div className="g-glow" style={{
          position: 'absolute', width: 340, height: 340, borderRadius: '50%',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(129,140,248,0.2) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* AI Voice Platform badge */}
        <div className="g-badge" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(129,140,248,0.1)',
          border: '1px solid rgba(129,140,248,0.24)',
          borderRadius: 999, padding: '5px 13px', marginBottom: 22,
          width: 'fit-content', position: 'relative', zIndex: 1,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#818cf8' }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#818cf8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            AI Voice Platform
          </span>
        </div>

        {/* Title */}
        <h1 className="g-title" style={{
          fontSize: 38, fontWeight: 800, lineHeight: 1.05,
          color: '#ffffff', letterSpacing: '-0.04em',
          marginBottom: 16, position: 'relative', zIndex: 1,
          textShadow: '0 2px 24px rgba(0,0,0,0.85), 0 0 48px rgba(0,0,0,0.6)',
        }}>
          Imperio<br />
          <span style={{ background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.7))' }}>AI</span> Voice<br />
          Agent
        </h1>

        {/* Subtitle */}
        <p className="g-sub" style={{
          fontSize: 12.5, lineHeight: 1.65, color: '#e2e8f0',
          marginBottom: 28, letterSpacing: '-0.01em',
          maxWidth: 196, position: 'relative', zIndex: 1,
          textShadow: '0 1px 12px rgba(0,0,0,0.8)',
        }}>
          Real-time outbound calling powered by LiveKit voice AI and intelligent agent routing.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', zIndex: 1 }}>
          {([
            { value: 'Live',   label: 'Agent Status' },
            { value: 'Gemini', label: 'AI Model' },
            { value: 'SIP',    label: 'Provider' },
          ] as const).map((s) => (
            <div key={s.label} className="g-stat" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '9px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.03em' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <header className="g-header" style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', height: 56,
          background: 'rgba(6,4,18,0.94)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px rgba(34,197,94,0.35)',
                overflow: 'hidden',
              }}>
                <img src="/logo.jpg" alt="Imperio" style={{ width: 18, height: 18, objectFit: 'contain', filter: 'invert(1)', display: 'block' }} />
              </div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em' }}>OutboundAI</span>
            </div>
            <span style={{
              padding: '3px 9px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', borderRadius: 999,
              background: 'rgba(34,197,94,0.1)', color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.2)',
            }}>Dashboard</span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: agentColor, display: 'inline-block', flexShrink: 0,
                boxShadow: agentGlow, transition: 'all 0.3s',
              }} />
              <span style={{ fontSize: 12, color: agentColor, fontWeight: 500, letterSpacing: '-0.01em', transition: 'color 0.3s' }}>{agentLabel}</span>
              {!agentOnline && agentOnline !== null && (
                <button onClick={restartAgent} disabled={restarting} style={{
                  padding: '4px 11px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                  cursor: restarting ? 'not-allowed' : 'pointer',
                  background: 'rgba(248,113,113,0.08)', color: '#f87171',
                  border: '1px solid rgba(248,113,113,0.2)', transition: 'all 0.18s', fontFamily: 'inherit',
                }}>
                  {restarting ? '↻ Starting…' : '↻ Start Agent'}
                </button>
              )}
              {agentOnline && (
                <button onClick={restartAgent} disabled={restarting} style={{
                  padding: '4px 11px', fontSize: 11, fontWeight: 500, borderRadius: 6,
                  cursor: restarting ? 'not-allowed' : 'pointer',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', transition: 'all 0.18s', fontFamily: 'inherit',
                }}>
                  {restarting ? '↻ Restarting…' : '↻ Restart'}
                </button>
              )}
            </div>
            <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>{clock}</span>
          </div>
        </header>

        {/* ── Navigation ── */}
        <nav className="g-nav" style={{
          display: 'flex', alignItems: 'center',
          background: 'rgba(6,4,18,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0, overflowX: 'auto',
          padding: '6px 16px', gap: 1,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        } as React.CSSProperties}>
          {NAV.map(tab => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`nav-tab${isActive ? ' nav-tab-active' : ''}`}
              >
                {tab.label}
                {tab.alert && (
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#ef4444', display: 'inline-block',
                    boxShadow: '0 0 6px rgba(239,68,68,0.8)',
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Content ── */}
        <main className="g-content" style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {TAB_MAP[active]}
        </main>
      </div>
    </div>
  );
}
