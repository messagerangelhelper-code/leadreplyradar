:root {
  --bg: #0b1220;
  --bg2: #0e1626;
  --card: #141e30;
  --border: #1e2a40;
  --orange: #ff7a1a;
  --green: #2ecc71;
  --blue: #3b82f6;
  --purple: #a78bfa;
  --muted: #8a96a8;
  --red: #ef4444;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
button { font: inherit; cursor: pointer; }
h1 { font-size: 22px; margin: 0; }
h2 { font-size: 17px; margin: 18px 0 8px; }
.wrap { max-width: 560px; margin: 0 auto; padding: 14px 16px 96px; }
.center { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.orange { color: var(--orange); }
.green { color: var(--green); }
.error { color: #fca5a5; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 15px; padding: 14px; margin-bottom: 10px; }
.note { background: var(--bg2); }

.topbar { position: sticky; top: 0; z-index: 5; background: var(--bg); display: flex; justify-content: space-between; align-items: center; padding: 6px 0 12px; }
.unread-pill { background: rgba(255,122,26,.15); color: var(--orange); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 600; }

.btn { border: 0; border-radius: 12px; padding: 12px 16px; color: #fff; font-weight: 600; display: inline-block; text-decoration: none; text-align: center; }
.btn-orange { background: var(--orange); }
.btn-blue { background: var(--blue); }
.full { width: 100%; margin-bottom: 12px; }
.link { background: none; border: 0; color: var(--blue); padding: 0; }
.icon-btn { background: var(--card); border: 1px solid var(--border); color: #fff; border-radius: 10px; width: 40px; height: 40px; flex: none; }

.alert-banner { width: 100%; border: 0; border-radius: 12px; padding: 12px; margin-bottom: 12px; background: var(--red); color: #fff; font-weight: 700; animation: pulse 1.2s infinite; }
@keyframes pulse { 50% { opacity: .65; } }

.radar { position: relative; width: min(78vw, 300px); aspect-ratio: 1; margin: 6px auto 16px; border-radius: 50%; overflow: hidden; background: radial-gradient(circle, #0f2a24 0%, var(--bg2) 70%); border: 1px solid var(--border); }
.radar-grid { position: absolute; inset: 0; width: 100%; height: 100%; }
.radar-grid circle, .radar-grid line { fill: none; stroke: rgba(46,204,113,.25); stroke-width: 1; }
.sweep { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(46,204,113,.55), rgba(46,204,113,0) 70deg, transparent 360deg); animation: spin 3s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.blip { position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; }
.blip-normal { background: var(--orange); opacity: .7; }
.blip-hot { background: var(--orange); box-shadow: 0 0 10px 3px rgba(255,122,26,.8); animation: pulse 1s infinite; }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid2 .card { margin-bottom: 0; }
.metric b { display: block; font-size: 26px; }
.metric span { color: var(--muted); font-size: 13px; }
.section-head { display: flex; justify-content: space-between; align-items: center; }

.toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.search, input[type='password'] { flex: 1; width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: 10px; color: #fff; padding: 10px 12px; font-size: 15px; }
.filters { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 2px; }
.chip { background: var(--card); border: 1px solid var(--border); color: var(--muted); border-radius: 999px; padding: 6px 13px; white-space: nowrap; }
.chip-on { background: var(--orange); border-color: var(--orange); color: #fff; }

.mail { cursor: pointer; }
.mail-hot { border-color: rgba(255,122,26,.6); }
.mail-top { display: flex; gap: 10px; }
.avatar { width: 38px; height: 38px; border-radius: 50%; background: #22304a; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex: none; }
.mail-main { flex: 1; min-width: 0; }
.mail-name { font-weight: 600; font-size: 15px; }
.mail-subj { font-size: 14px; margin: 2px 0; }
.clamp { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.mail-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
.dot-unread { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--blue); margin-right: 6px; }
.mail-open { margin-top: 8px; border-top: 1px solid var(--border); padding-top: 8px; }
.reasons { color: var(--muted); padding-left: 18px; margin: 6px 0 10px; }

.score { font-size: 12px; font-weight: 700; border-radius: 8px; padding: 3px 8px; }
.score-hot { background: rgba(255,122,26,.18); color: var(--orange); }
.score-mid { background: rgba(59,130,246,.18); color: #93c5fd; }
.score-low { background: rgba(138,150,168,.15); color: var(--muted); }
.score-cold { background: rgba(138,150,168,.08); color: #5d6878; }

.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.tag { font-size: 12px; border-radius: 999px; padding: 3px 10px; font-weight: 600; }
.tag-hot { background: rgba(255,122,26,.2); color: var(--orange); }
.tag-int { background: rgba(46,204,113,.18); color: var(--green); }
.tag-q { background: rgba(59,130,246,.18); color: #93c5fd; }
.tag-meet { background: rgba(167,139,250,.2); color: var(--purple); }
.tag-acct { background: rgba(239,68,68,.18); color: #fca5a5; }
.tag-unsub { background: rgba(138,150,168,.15); color: var(--muted); }
.tag-warn { background: #facc15; color: #111; }

.bars { display: flex; gap: 8px; align-items: flex-end; height: 180px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.bar-num { font-size: 12px; color: var(--muted); }
.bar-track { position: relative; flex: 1; width: 100%; display: flex; align-items: flex-end; }
.bar { width: 100%; background: var(--blue); border-radius: 6px 6px 2px 2px; min-height: 2px; }
.bar-best { background: #5b9bff; }
.bar-hot { position: absolute; bottom: 0; left: 0; width: 100%; background: var(--orange); border-radius: 2px; }
.insight { margin: 12px 0 0; font-size: 14px; }

.toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); gap: 10px; }
.toggle-row:last-child { border-bottom: 0; }
.switch { width: 46px; height: 26px; border-radius: 999px; border: 0; background: #2a3650; position: relative; flex: none; }
.switch span { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left .15s; }
.switch-on { background: var(--green); }
.switch-on span { left: 23px; }
.badge-soon { font-size: 11px; font-weight: 700; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; }
.tool { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

.login { width: 100%; max-width: 340px; display: flex; flex-direction: column; gap: 12px; }

.bottomnav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; background: var(--bg2); border-top: 1px solid var(--border); padding: 8px 4px calc(8px + env(safe-area-inset-bottom)); }
.bottomnav button { background: none; border: 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; font-size: 11px; gap: 2px; }
.bottomnav button span { font-size: 18px; }
.bottomnav .nav-on { color: var(--orange); }
