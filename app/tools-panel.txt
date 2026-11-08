'use client';

// The 5 tools on the Tools page: Lead Finder, Sequences, PDF Reports, A/B Subject Lines, AI Calling Agent.
// Everything runs on your own accounts (Gmail, Twilio, your AI key). Nothing is emailed or
// called until you press the button and say OK.

import { useCallback, useEffect, useState } from 'react';

function getToken() {
  try {
    return localStorage.getItem('lrr_token') || '';
  } catch (e) {
    return '';
  }
}
function api(url, opts = {}) {
  const t = getToken();
  return fetch(url, { ...opts, credentials: 'same-origin', headers: { ...(opts.headers || {}), ...(t ? { 'x-lrr-auth': t } : {}) } });
}
async function post(action, data) {
  const res = await api('/api/tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
async function download(url, name) {
  const res = await api(url);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Could not make the file.');
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

function countPeople(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((l) => /[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}/i.test(l)).length;
}
function when(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}
function nicePhone(p) {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : p;
}

const box = { width: '100%', boxSizing: 'border-box', fontSize: 15, padding: 10, borderRadius: 10, background: 'var(--card)', color: 'inherit', border: '1px solid var(--border)', marginBottom: 8 };
const row = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 };
const small = { padding: '8px 12px', fontSize: 13 };
const DEFAULT_FOOTER = "If you'd rather not get these emails, just reply and let me know.";

export default function ToolsPanel({ onSignIn }) {
  const [st, setSt] = useState(null);
  const [open, setOpen] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [seqPeople, setSeqPeople] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await api('/api/tools?action=status', { cache: 'no-store' });
      if (res.status === 401) {
        if (onSignIn) onSignIn();
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (j.ok) setSt(j);
      else if (j.error) setErr(j.error);
    } catch (e) {}
  }, [onSignIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fast = st && ((st.leadJob && st.leadJob.running) || (st.calls || []).some((c) => c.status === 'calling' || c.status === 'in-progress' || c.status === 'ringing' || c.status === 'queued'));
  useEffect(() => {
    const t = setInterval(refresh, fast ? 5000 : 30000);
    return () => clearInterval(t);
  }, [refresh, fast]);

  const act = async (name, fn, okText) => {
    if (busy) return;
    setBusy(name);
    setErr('');
    setMsg('');
    try {
      const r = await fn();
      if (okText) setMsg(typeof okText === 'function' ? okText(r) : okText);
      await refresh();
      return r;
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy('');
    }
  };

  const o = (st && st.outreach) || { sequences: [], tests: [], sentToday: 0, dailyLimit: 300 };
  const running = o.sequences.filter((s) => s.status === 'running').length;
  const tiles = [
    { key: 'leads', name: 'Lead Finder', text: st && st.leadJob && st.leadJob.running ? 'Searching…' : (st ? st.leads.length : 0) + ' lead lists' },
    { key: 'seq', name: 'Sequences', text: running ? running + ' running' : o.sequences.length + ' sequences' },
    { key: 'pdf', name: 'PDF Reports', text: 'This week in one PDF' },
    { key: 'ab', name: 'A/B Subject Lines', text: o.tests.length + ' tests' },
    { key: 'call', name: 'AI Calling Agent', text: st && st.callsOn ? (st.phones || []).length + ' people to call' : 'Needs Twilio' },
  ];

  return (
    <div>
      <div className="grid2">
        {tiles.map((t) => (
          <button
            key={t.key}
            className="card tool"
            style={{ textAlign: 'left', color: 'inherit', outline: open === t.key ? '2px solid var(--orange)' : 'none' }}
            onClick={() => {
              setOpen(open === t.key ? '' : t.key);
              setMsg('');
              setErr('');
            }}
          >
            <b>{t.name}</b>
            <span className="muted small">{t.text}</span>
            <span className="tag tag-int">{open === t.key ? 'Close' : 'Open'}</span>
          </button>
        ))}
      </div>
      {(msg || err) && (
        <div className="card note small" style={{ marginTop: 10 }}>
          {msg && <span className="green">{msg}</span>}
          {err && <span style={{ color: '#ff6b6b' }}>{err}</span>}
        </div>
      )}
      {st && st.store && st.store.error && <p className="error small">{st.store.error}</p>}
      <div style={{ marginTop: 10 }}>
        {open === 'pdf' && <PdfTool st={st} busy={busy} act={act} />}
        {open === 'seq' && <SeqTool o={o} busy={busy} act={act} people={seqPeople} setPeople={setSeqPeople} />}
        {open === 'ab' && <AbTool o={o} busy={busy} act={act} />}
        {open === 'leads' && (
          <LeadTool
            st={st}
            busy={busy}
            act={act}
            useInSequence={(list) => {
              const lines = list.results.filter((r) => r.email).map((r) => r.name + ', ' + r.email);
              setSeqPeople(lines.join('\n'));
              setOpen('seq');
              setMsg(lines.length + ' emails copied into a new sequence. Check them before you press Start.');
            }}
          />
        )}
        {open === 'call' && <CallTool st={st} busy={busy} act={act} />}
      </div>
    </div>
  );
}

// ---------- PDF Reports ----------
function PdfTool({ st, busy, act }) {
  const me = st && st.outreach ? st.outreach.from : '';
  return (
    <div className="card">
      <b>PDF Reports</b>
      <p className="muted small">This week's mail, hot emails, AI sort, top senders, sequences, A/B tests, leads and calls, in one PDF.</p>
      <div style={row}>
        <button className="btn btn-orange" disabled={Boolean(busy)} onClick={() => act('pdf', () => download('/api/tools?action=pdf', 'LeadReplyRadar-report-' + new Date().toISOString().slice(0, 10) + '.pdf'), 'Report downloaded.')}>
          {busy === 'pdf' ? 'Making…' : 'Download PDF'}
        </button>
        <button
          className="btn btn-blue"
          disabled={Boolean(busy)}
          onClick={() => {
            if (!window.confirm('Email the report to yourself?\n\nTo: ' + (me || 'your Gmail'))) return;
            act('pdfmail', () => post('pdf_email'), (r) => 'Report emailed to ' + r.to + '.');
          }}
        >
          {busy === 'pdfmail' ? 'Sending…' : 'Email it to me'}
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>On a phone, "Email it to me" is the easy way to keep it.</p>
    </div>
  );
}

// ---------- Sequences ----------
function SeqTool({ o, busy, act, people, setPeople }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([{ day: 0, subject: '', body: '' }]);
  const [footer, setFooter] = useState(DEFAULT_FOOTER);
  const n = countPeople(people);
  const setStep = (i, patch) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const start = () => {
    const later = steps.slice(1).filter((s) => s.body.trim());
    const plan = later.length ? '\nThen follow-ups on day ' + later.map((s) => s.day).join(', ') + ' to anyone who has not replied.' : '';
    if (!window.confirm('Start "' + (name || 'this sequence') + '"?\n\nSends the first email to ' + n + ' people from ' + o.from + ', a few every 5 minutes.' + plan + '\n\nEmails that went out cannot be taken back. You can pause or stop it any time.')) return;
    act('seqstart', () => post('seq_start', { name, steps, people, footer }), (r) => 'Started. Sending to ' + r.people + ' people' + (r.skipped ? ' (' + r.skipped + ' lines were not emails)' : '') + '.').then((r) => {
      if (r) {
        setName('');
        setSteps([{ day: 0, subject: '', body: '' }]);
        setPeople('');
      }
    });
  };
  return (
    <div>
      <div className="card note small">
        Sends from <b>{o.from || 'your Gmail'}</b> · today {o.sentToday} of {o.dailyLimit} · anyone who replies is taken off.
        {o.error && <p className="error small">Last problem: {o.error}</p>}
      </div>
      {o.sequences.map((s) => (
        <OutreachRow key={s.id} kind="seq" item={s} busy={busy} act={act}>
          <span className="muted small">
            {s.people} people · {s.sent} sent · {s.opened} opened · <b className="green">{s.replied} replied</b> · {s.steps.length} email{s.steps.length === 1 ? '' : 's'}
            {s.errors ? ' · ' + s.errors + ' could not be sent' : ''}
          </span>
          {s.replies && s.replies.length > 0 && <span className="muted small">Replied: {s.replies.join(', ')}</span>}
        </OutreachRow>
      ))}
      <div className="card">
        <b>New sequence</b>
        <input style={box} placeholder="Name (only you see it)" value={name} onChange={(e) => setName(e.target.value)} />
        {steps.map((s, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none', paddingTop: i ? 8 : 0 }}>
            <p className="small" style={{ margin: '4px 0' }}>
              <b>{i === 0 ? 'Email 1 (sent right away)' : 'Follow-up ' + i}</b>
              {i > 0 && (
                <>
                  {' '}on day{' '}
                  <input type="number" min="1" max="60" value={s.day} onChange={(e) => setStep(i, { day: Number(e.target.value) })} style={{ ...box, width: 70, display: 'inline-block', margin: 0, padding: 6 }} />
                  {' '}
                  <button className="link small" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>Remove</button>
                </>
              )}
            </p>
            <input style={box} placeholder={i === 0 ? 'Subject' : 'Subject (leave empty to reply in the same thread)'} value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} />
            <textarea style={box} rows={5} placeholder={'Hi {{name}},\n\n…'} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} />
          </div>
        ))}
        {steps.length < 5 && (
          <button className="btn btn-blue" style={small} onClick={() => setSteps([...steps, { day: (steps[steps.length - 1].day || 0) + 3, subject: '', body: '' }])}>
            Add follow-up
          </button>
        )}
        <p className="small" style={{ margin: '10px 0 4px' }}>
          <b>Who gets it</b> <span className="muted">one per line, like "Jo Smith, jo@shop.com" · {n} people</span>
        </p>
        <textarea style={box} rows={5} placeholder={'Jo Smith, jo@shop.com\nsam@store.com'} value={people} onChange={(e) => setPeople(e.target.value)} />
        <p className="small" style={{ margin: '4px 0' }}><b>Last line of every email</b></p>
        <textarea style={box} rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} />
        <p className="muted small">Use {'{{name}}'} for their first name. Only add people who know you or asked to hear from you.</p>
        <button className="btn btn-orange" disabled={Boolean(busy) || !n || !steps[0].subject.trim() || !steps[0].body.trim()} onClick={start}>
          {busy === 'seqstart' ? 'Starting…' : 'Start sequence'}
        </button>
      </div>
    </div>
  );
}

function OutreachRow({ kind, item, busy, act, children }) {
  const change = (what) => {
    if (what === 'delete' && !window.confirm('Delete "' + item.name + '" and its results?')) return;
    if (what === 'stop' && !window.confirm('Stop "' + item.name + '"? Nothing more will be sent.')) return;
    act('chg' + item.id, () => post('outreach_change', { kind: kind === 'seq' ? 'seq' : 'test', id: item.id, what }), 'Done.');
  };
  const live = item.status === 'running' || item.status === 'sending';
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <b>
        {item.name} <span className="badge-soon">{item.status === 'done' ? 'finished' : item.status}</span>
      </b>
      <span className="muted small">Started {when(item.createdAt)}</span>
      {children}
      <div style={row}>
        {live && <button className="btn btn-blue" style={small} disabled={Boolean(busy)} onClick={() => change('pause')}>Pause</button>}
        {item.status === 'paused' && <button className="btn btn-blue" style={small} disabled={Boolean(busy)} onClick={() => change('resume')}>Resume</button>}
        {item.status !== 'done' && <button className="btn btn-blue" style={small} disabled={Boolean(busy)} onClick={() => change('stop')}>Stop</button>}
        <button className="btn btn-blue" style={small} disabled={Boolean(busy)} onClick={() => change('delete')}>Delete</button>
      </div>
    </div>
  );
}

// ---------- A/B Subject Lines ----------
function Bar({ label, value }) {
  return (
    <div className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 90 }}>{label}</span>
      <span style={{ flex: 1, background: 'var(--bg2)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: Math.min(100, value) + '%', height: '100%', background: 'var(--orange)' }} />
      </span>
      <b style={{ width: 40, textAlign: 'right' }}>{value}%</b>
    </div>
  );
}

function AbTool({ o, busy, act }) {
  const [f, setF] = useState({ name: '', subjectA: '', subjectB: '', body: '', people: '', footer: DEFAULT_FOOTER });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const n = countPeople(f.people);
  const start = () => {
    if (!window.confirm('Send "' + (f.name || 'this test') + '"?\n\nHalf of ' + n + ' people get subject A, half get subject B, from ' + o.from + ', a few every 5 minutes.\n\nEmails that went out cannot be taken back.')) return;
    act('abstart', () => post('ab_start', f), (r) => 'Sending to ' + r.people + ' people.').then((r) => {
      if (r) setF({ name: '', subjectA: '', subjectB: '', body: '', people: '', footer: DEFAULT_FOOTER });
    });
  };
  return (
    <div>
      <div className="card note small">
        Half get subject A, half get B. Replies are exact. Opens are rough: some mail apps block pictures, some load them by themselves.
        {!o.tracking && <p className="error small">Open counting is off because the app does not know its web address (RENDER_EXTERNAL_URL).</p>}
      </div>
      {o.tests.map((t) => (
        <OutreachRow key={t.id} kind="test" item={t} busy={busy} act={act}>
          {['A', 'B'].map((v) => (
            <div key={v} style={{ marginTop: 4 }}>
              <span className="small">
                <b>{v}{t.winner === v ? ' · winner' : ''}:</b> {v === 'A' ? t.subjectA : t.subjectB} <span className="muted">({t[v].sent} sent)</span>
              </span>
              <Bar label="Opened" value={t[v].openRate} />
              <Bar label="Replied" value={t[v].replyRate} />
            </div>
          ))}
          {!t.winner && <span className="muted small">A winner shows once each side has 5 sent.</span>}
        </OutreachRow>
      ))}
      <div className="card">
        <b>New A/B test</b>
        <input style={box} placeholder="Name (only you see it)" value={f.name} onChange={set('name')} />
        <input style={box} placeholder="Subject A" value={f.subjectA} onChange={set('subjectA')} />
        <input style={box} placeholder="Subject B" value={f.subjectB} onChange={set('subjectB')} />
        <textarea style={box} rows={5} placeholder={'Hi {{name}},\n\n…'} value={f.body} onChange={set('body')} />
        <p className="small" style={{ margin: '4px 0' }}>
          <b>Who gets it</b> <span className="muted">one per line · {n} people</span>
        </p>
        <textarea style={box} rows={5} placeholder={'Jo Smith, jo@shop.com\nsam@store.com'} value={f.people} onChange={set('people')} />
        <p className="small" style={{ margin: '4px 0' }}><b>Last line of the email</b></p>
        <textarea style={box} rows={2} value={f.footer} onChange={set('footer')} />
        <button className="btn btn-orange" disabled={Boolean(busy) || n < 2 || !f.subjectA.trim() || !f.subjectB.trim() || !f.body.trim()} onClick={start}>
          {busy === 'abstart' ? 'Starting…' : 'Send A/B test'}
        </button>
      </div>
    </div>
  );
}

// ---------- Lead Finder ----------
function LeadTool({ st, busy, act, useInSequence }) {
  const [q, setQ] = useState('');
  const [count, setCount] = useState(10);
  const job = (st && st.leadJob) || {};
  const lists = (st && st.leads) || [];
  return (
    <div>
      <div className="card">
        <b>Lead Finder</b>
        <p className="muted small">Describe who you want. The AI searches the web and lists businesses that fit. It never contacts anyone.</p>
        <input style={box} placeholder='Like "apartment complexes in Austin, TX that get lots of packages"' value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ ...row, alignItems: 'center' }}>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ ...box, width: 'auto', margin: 0 }}>
            {[5, 10, 20].map((x) => (
              <option key={x} value={x}>{x} leads</option>
            ))}
          </select>
          <button
            className="btn btn-orange"
            disabled={Boolean(busy) || job.running || q.trim().length < 5 || !(st && st.ai)}
            onClick={() => act('leads', () => post('leads_find', { query: q, count }), 'Searching. This takes a minute or two; you can leave this page.')}
          >
            {job.running ? 'Searching…' : 'Find leads'}
          </button>
        </div>
        {st && !st.ai && <p className="error small">Needs ANTHROPIC_API_KEY on Render.</p>}
        {job.running && <p className="muted small">Looking for: {job.query}</p>}
        {!job.running && job.error && <p className="error small">Last search: {job.error}</p>}
      </div>
      {lists.map((l) => (
        <div className="card" key={l.id}>
          <b>{l.query}</b>
          <span className="muted small"> · {l.results.length} found · {when(l.at)}</span>
          {l.results.map((r, i) => (
            <div key={i} className="small" style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
              <b>{r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer" className="link">{r.name}</a> : r.name}</b>
              {r.city && <span className="muted"> · {r.city}</span>}
              {r.why && <div className="muted">{r.why}</div>}
              {(r.email || r.phone) && (
                <div>
                  {r.email}
                  {r.email && r.phone ? ' · ' : ''}
                  {r.phone}
                </div>
              )}
            </div>
          ))}
          <div style={row}>
            <button className="btn btn-blue" style={small} disabled={Boolean(busy)} onClick={() => act('csv', () => download('/api/tools?action=csv&id=' + encodeURIComponent(l.id), 'leads-' + l.at.slice(0, 10) + '.csv'), 'CSV downloaded.')}>
              Download CSV
            </button>
            {l.results.some((r) => r.email) && (
              <button className="btn btn-blue" style={small} onClick={() => useInSequence(l)}>
                Use in a sequence
              </button>
            )}
            <button
              className="btn btn-blue"
              style={small}
              disabled={Boolean(busy)}
              onClick={() => window.confirm('Delete this lead list?') && act('ldel', () => post('leads_delete', { id: l.id }), 'Deleted.')}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- AI Calling Agent ----------
function CallTool({ st, busy, act }) {
  const [pick, setPick] = useState('');
  const [goal, setGoal] = useState('');
  const phones = (st && st.phones) || [];
  const calls = (st && st.calls) || [];
  const on = st && st.callsOn;
  const call = (p) => {
    if (!window.confirm('Call ' + p.name + ' at ' + nicePhone(p.phone) + ' now?\n\nAn AI assistant will say it is calling for you, and talk about:\n' + goal + '\n\nTwilio charges your account per minute.')) return;
    act('call', () => post('call_start', { phone: p.phone, emailId: p.id, goal }), 'Calling ' + p.name + '…').then((r) => {
      if (r) {
        setPick('');
        setGoal('');
      }
    });
  };
  return (
    <div>
      <div className="card note small">
        Only calls people who wrote their phone number in an email to you this week. It says it is an AI assistant calling for you. Only call people who asked you to call them.
        {!on && <p className="error small">Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM and ANTHROPIC_API_KEY on Render.</p>}
        <p className="muted small" style={{ margin: '6px 0 0' }}>A Twilio trial account can only call numbers you verified in Twilio.</p>
      </div>
      <div className="card">
        <b>People who emailed you a phone number</b>
        {!phones.length && <p className="muted small">None this week.</p>}
        {phones.map((p) => (
          <div key={p.id + p.phone} className="small" style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <b>{p.name}</b> · {nicePhone(p.phone)}
            <div className="muted">{p.summary || p.subject}</div>
            {p.blocked ? (
              <div className="muted">Asked not to be called.</div>
            ) : pick === p.id + p.phone ? (
              <div>
                <textarea style={{ ...box, marginTop: 6 }} rows={2} placeholder="What is the call for? Like: confirm the pickup time for their package" value={goal} onChange={(e) => setGoal(e.target.value)} />
                <div style={row}>
                  <button className="btn btn-orange" style={small} disabled={Boolean(busy) || goal.trim().length < 5 || !on} onClick={() => call(p)}>
                    {busy === 'call' ? 'Calling…' : 'Start AI call'}
                  </button>
                  <button className="btn btn-blue" style={small} onClick={() => setPick('')}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={row}>
                <button className="btn btn-blue" style={small} disabled={!on} onClick={() => setPick(p.id + p.phone)}>Call</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {calls.length > 0 && (
        <div className="card">
          <b>Calls</b>
          {calls.map((c) => (
            <div key={c.id} className="small" style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
              <b>{c.name}</b> · {nicePhone(c.to)} · <span className="muted">{c.status} · {when(c.createdAt)}</span>
              {c.summary && <div>{c.summary}</div>}
              {c.nextStep && c.nextStep !== 'None' && <div className="green">Next: {c.nextStep}</div>}
              {c.turns && c.turns.length > 0 && (
                <details>
                  <summary className="muted">Transcript</summary>
                  {c.turns.map((t, i) => (
                    <div key={i} style={{ margin: '4px 0' }}>
                      <b>{t.who === 'ai' ? 'AI' : c.name.split(' ')[0] || 'Them'}:</b> {t.text}
                    </div>
                  ))}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
