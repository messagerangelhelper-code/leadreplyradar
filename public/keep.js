<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>LeadReplyRadar Preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter+Tight:wght@400;500;600&display=swap">
<style>
/* Layout: one full-height stage, slide text in the middle, big control bar fixed to the bottom. Single dark CashCow look. */
:root{
  --bg:#15131F; --panel:#221F32; --ink:#FFFFFF; --muted:#BDB8CF; --gold:#D4A94D; --purple:#3C3489; --hot:#FF8C3C;
  --display:'Sora',system-ui,sans-serif; --body:'Inter Tight',system-ui,sans-serif;
  color-scheme:dark;
}
html,body{height:100%}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;gap:10px;padding-block:14px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));border-bottom:3px solid var(--gold);background:#0D0C14}
header b{font-family:var(--display);font-size:18px}
header span{color:var(--gold);font-size:14px;font-weight:600}
header .count{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums;font-size:14px}
main{flex:1;min-height:0;overflow-y:auto;display:flex;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.slide{margin:auto;width:100%;max-width:820px;display:flex;flex-direction:column;gap:14px}
.center{text-align:center;align-items:center}
.num{width:52px;height:52px;border-radius:50%;background:var(--gold);color:var(--bg);display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:22px;flex:none}
.head{display:flex;gap:16px;align-items:center}
h1{font-family:var(--display);font-size:clamp(28px,5vw,44px);margin:0;line-height:1.1;text-wrap:balance}
h2{font-family:var(--display);font-size:clamp(26px,4.4vw,38px);margin:0;line-height:1.15;text-wrap:balance}
.tag{color:var(--gold);font-weight:600;font-size:18px;margin-top:4px}
ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
li{background:var(--panel);border-left:5px solid var(--purple);border-radius:10px;padding:14px 16px;line-height:1.45;font-size:clamp(16px,2.2vw,19px);opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s}
li.on{opacity:1;transform:none}
.use{color:var(--muted);font-size:16px;line-height:1.45;opacity:0;transition:opacity .4s}
.use.on{opacity:1}
.use b{color:var(--gold)}
p.lead{color:var(--muted);font-size:clamp(17px,2.4vw,21px);line-height:1.5;max-width:40ch;margin:0}
.url{color:var(--gold);font-weight:600;font-size:20px}
canvas{width:180px;height:180px;max-width:100%}
.bar{height:5px;background:#2A2738}
.bar i{display:block;height:100%;width:0;background:var(--gold);transition:width .3s linear}
.controls{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:10px;padding-block:12px calc(12px + env(safe-area-inset-bottom,0px));padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));background:#0D0C14}
button{font:600 18px var(--body);min-height:56px;border-radius:12px;border:2px solid #3A3650;background:var(--panel);color:var(--ink);cursor:pointer}
button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
button.main{background:var(--gold);border-color:var(--gold);color:var(--bg);font-size:20px}
button:disabled{opacity:.4;cursor:default}
.paused{color:var(--gold);font-size:14px;text-align:center;padding-top:6px;min-height:20px}
@media (prefers-reduced-motion:reduce){li,.use{transition:none}}
*{box-sizing:border-box}
body{margin:0}
</style>
</head>
<body>
<header><b>LeadReplyRadar</b><span>by CashCow</span><div class="count" id="count"></div></header>
<main><div class="slide" id="slide"></div></main>
<div class="paused" id="pausedNote"></div>
<div class="bar"><i id="bar"></i></div>
<div class="controls">
  <button id="back" aria-label="Back one slide">◀ Back</button>
  <button id="play" class="main" aria-label="Pause">❚❚ Pause</button>
  <button id="next" aria-label="Next slide">Next ▶</button>
</div>
<script>
const FEATURES = [{"name": "Radar", "tag": "Your home screen", "points": ["Shows this week's emails as dots on a radar, with the most important closest to the center.", "Four quick numbers: emails this week, Hot (reply fast), meetings asked, and emails that need a reply.", "Top of the radar lists your three most important emails. Tap one to open it."], "use": "Open the app and start here each morning to see what needs you first."}, {"name": "Lead scoring", "tag": "Hot emails rise to the top", "points": ["Every email gets a score. A score of 80 or more is marked Hot.", "Hot covers deadlines, account notices, payment problems, and people replying to you.", "Senders who score 50 or more count as important."], "use": "Answer Hot emails first. That is where money and deadlines usually are."}, {"name": "Inbox", "tag": "All your mail, sorted", "points": ["Search your emails, refresh, or pause the live feed.", "Filter chips: All, Hot, Account, Interested, Meeting and Question. With AI on, also Decide, Routine and Noise.", "Press Sort my inbox with AI to sort everything at once."], "use": "Tap a filter to see only that kind of email."}, {"name": "Draft reply and Send", "tag": "Answer in seconds", "points": ["Open an email and press Draft reply. The AI writes a reply you can edit.", "Press Send. The app shows who it goes to and from, and asks you to confirm.", "Replies go out from your own Gmail. Nothing sends until you confirm."], "use": "Read the draft, change anything you like, then press Send."}, {"name": "Analytics", "tag": "See your week at a glance", "points": ["A bar chart of the last 7 days, with Hot mail shown in orange.", "Hot share: how much of your mail is Hot.", "Hot still unread: urgent emails you have not opened yet."], "use": "Check it weekly to spot your busiest days."}, {"name": "Alerts", "tag": "Never miss an urgent email", "points": ["Beep for every new email, or keep beeping on urgent mail until you look.", "Pop-up notifications on your screen, and a Send test alert button.", "Text alerts: the app checks your mail every 5 minutes, even with the page closed, and texts your phone about new Hot emails."], "use": "Turn on the alerts you want, then press Send test alert."}, {"name": "AI Assistant", "tag": "Six helpers in the Tools tab", "points": ["AI Project Coordinator: Plan my day makes today's to-do list from your mail, most urgent first.", "AI Books and Invoices: finds invoices, bills, receipts and payments. Full bookkeeping needs a books app.", "AI Support and Onboarding: finds customer problems and new clients.", "AI Inbox Filter: sorts mail into decision, routine or noise, with reply drafts.", "AI Focus Time: meeting requests to accept or skip. Blocking time needs a calendar.", "AI Follow-ups: people who are waiting on you."], "use": "Press a helper's button to see its list."}, {"name": "Brevo CRM Sync", "tag": "Your contacts, saved for you", "points": ["Every 5 minutes, important senders (score 50 or more) are saved to your Brevo contacts with a note.", "The Tools tab shows how many were saved since the last restart."], "use": "Open Brevo to see your new contacts building up."}, {"name": "PDF Reports", "tag": "Your week in one file", "points": ["One PDF with this week's mail, Hot emails, the AI sort, top senders, sequences, A/B tests, leads and calls.", "Download it, or press Email it to me and confirm."], "use": "Download a report every Friday to track your week."}, {"name": "Sequences", "tag": "Follow up without forgetting", "points": ["Write a short series of emails and add the people who should get them.", "Sends from your own Gmail, a few at a time every 5 minutes, with a daily limit to keep Gmail happy.", "Anyone who replies is taken off the sequence right away. Nothing starts until you press Start and confirm."], "use": "Only add people who know you or asked to hear from you."}, {"name": "A/B Subject Lines", "tag": "Find the subject that works", "points": ["Write two subject lines for the same email. Half your list gets each one.", "Opens are counted, and a winner shows once each side has 5 sent."], "use": "Use the winning subject line in your next email."}, {"name": "Lead Finder", "tag": "New customers to reach out to", "points": ["Describe who you want. The AI searches the web and lists businesses that fit.", "It never contacts anyone. You can copy the list into a new sequence and check it before you start."], "use": "Try a search like: roofing companies in Dallas."}, {"name": "AI Calling Agent", "tag": "Calls handled for you", "points": ["Calls a phone number someone wrote in an email they sent you, only when you press Call and confirm.", "It first says it is an AI assistant calling for you. Anyone who asks not to be called is never called again.", "Uses your own Twilio number. A Twilio trial account can only call numbers you verified in Twilio."], "use": "Open the tool to see this week's people to call."}, {"name": "Lead Radar in CashCow Mail", "tag": "Everything in one place", "points": ["LeadReplyRadar also opens inside CashCow Mail as the Lead Radar tab.", "Same radar, same Hot emails, right next to your mail."], "use": "Open CashCow Mail and tap Lead Radar."}];
const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const slides = [
  {kind:'title', secs:6},
  {kind:'intro', secs:9},
  ...FEATURES.map((f,i)=>({kind:'feature', f, i:i+1, secs:5 + f.points.length*2.2})),
  {kind:'control', secs:9},
  {kind:'end', secs:8},
];
let idx=0, playing=true, elapsed=0, timers=[], last=performance.now(), raf=0;
const $=id=>document.getElementById(id);
function render(){
  timers.forEach(clearTimeout); timers=[];
  const s=slides[idx], el=$('slide');
  el.className='slide'+(['title','intro','control','end'].includes(s.kind)?' center':'');
  if(s.kind==='title') el.innerHTML='<canvas id="rad" width="360" height="360" aria-hidden="true"></canvas><h1>LeadReplyRadar</h1><div class="tag">by CashCow</div><p class="lead">Never miss the emails that bring in money.</p>';
  if(s.kind==='intro') el.innerHTML='<h2>Missed emails mean missed money</h2><p class="lead">LeadReplyRadar reads your Gmail and points out the emails that need a fast answer: new leads, customer questions, payments and deadlines.</p><p class="lead" style="color:var(--ink)">5 tabs: Radar · Inbox · Analytics · Alerts · Tools</p>';
  if(s.kind==='feature') el.innerHTML='<div class="head"><div class="num">'+s.i+'</div><div><h2>'+esc(s.f.name)+'</h2><div class="tag">'+esc(s.f.tag)+'</div></div></div><ul>'+s.f.points.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul><div class="use"><b>How to use it:</b> '+esc(s.f.use)+'</div>';
  if(s.kind==='control') el.innerHTML='<h2>You stay in control</h2><ul style="text-align:left"><li>Nothing sends, emails or calls until you press the button and confirm.</li><li>Replies and follow-ups go out from your own Gmail.</li><li>Lead Finder only shows a list. It never contacts anyone.</li></ul>';
  if(s.kind==='end') el.innerHTML='<canvas id="rad" width="360" height="360" aria-hidden="true"></canvas><h2>Try LeadReplyRadar today</h2><div class="url">leadreplyradar.onrender.com</div><p class="lead">Also in CashCow Mail as the Lead Radar tab.</p>';
  const items=[...el.querySelectorAll('li,.use')];
  items.forEach((it,k)=>timers.push(setTimeout(()=>it.classList.add('on'), 250+k*600)));
  $('count').textContent=(idx+1)+' of '+slides.length;
  $('back').disabled=idx===0; $('next').disabled=idx===slides.length-1;
  $('main')?.scrollTo?.(0,0); document.querySelector('main').scrollTop=0;
  elapsed=0; updateBar();
}
function updateBar(){ const s=slides[idx]; $('bar').style.width=Math.min(100,(idx+Math.min(1,elapsed/s.secs))/slides.length*100)+'%'; }
function go(n){ idx=Math.max(0,Math.min(slides.length-1,n)); render(); }
function setPlaying(p){ playing=p; $('play').innerHTML=p?'❚❚ Pause':'▶ Play'; $('play').setAttribute('aria-label',p?'Pause':'Play');
  $('pausedNote').textContent=p?'':'Paused. Take your time, then press Play or Next.'; }
function loop(now){
  const dt=(now-last)/1000; last=now;
  if(playing){ elapsed+=dt; if(elapsed>=slides[idx].secs){ if(idx<slides.length-1) go(idx+1); else setPlaying(false); } updateBar(); }
  const c=document.getElementById('rad'); if(c){ const x=c.getContext('2d'),W=360,R=150,a=now/450; x.clearRect(0,0,W,W);
    x.strokeStyle='#D4A94D'; x.lineWidth=4; [R,R*.66,R*.33].forEach(r=>{x.beginPath();x.arc(W/2,W/2,r,0,7);x.stroke();});
    x.beginPath(); x.moveTo(W/2,W/2); x.lineTo(W/2+R*Math.cos(a),W/2-R*Math.sin(a)); x.stroke();
    [[.7,.55,'#D4A94D',11],[2.4,.8,'#fff',7],[4.2,.4,'#fff',7],[5.5,.7,'#FF8C3C',9]].forEach(([g,r,col,s])=>{x.fillStyle=col;x.beginPath();x.arc(W/2+R*r*Math.cos(g),W/2-R*r*Math.sin(g),s,0,7);x.fill();}); }
  raf=requestAnimationFrame(loop);
}
$('play').onclick=()=>{ if(!playing && idx===slides.length-1 && elapsed>=slides[idx].secs) go(0); setPlaying(!playing); };
$('next').onclick=()=>go(idx+1);
$('back').onclick=()=>go(idx-1);
document.addEventListener('keydown',e=>{ if(e.key==='ArrowRight')go(idx+1); else if(e.key==='ArrowLeft')go(idx-1); else if(e.key===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();$('play').click();} });
if(matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
render(); requestAnimationFrame(loop);
</script>
</body>
</html>
