// PDF Reports. Makes the PDF inside the app (no outside service, no extra package).
// Report time zone: REPORT_TZ on Render (default America/Chicago).

const W = 612; // US Letter
const H = 792;
const M = 50;

const CHAR_MAP = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', ' ': ' ', '•': '-' };

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/[‘’“”–—… •]/g, (c) => CHAR_MAP[c])
    .replace(/[^\x20-\x7e\xa0-\xff]/gu, '?');
}

function esc(s) {
  return clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((x) => x.toFixed(3)).join(' ');
}

export class Pdf {
  constructor() {
    this.pages = [];
    this.newPage();
  }
  newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = H - M;
  }
  need(h) {
    if (this.y - h < M) this.newPage();
  }
  // Wraps text to the page width. Returns nothing; moves down.
  text(str, { size = 10, bold = false, color = '#222222', indent = 0, gap = 0 } = {}) {
    const maxChars = Math.max(10, Math.floor((W - 2 * M - indent) / (size * 0.52)));
    const lines = [];
    for (const para of clean(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        if (!line) line = word;
        else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
        else {
          lines.push(line);
          line = word;
        }
        while (line.length > maxChars) {
          lines.push(line.slice(0, maxChars));
          line = line.slice(maxChars);
        }
      }
      lines.push(line);
    }
    const lh = size * 1.35;
    for (const l of lines) {
      this.need(lh);
      this.y -= lh;
      this.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + rgb(color) + ' rg ' + (M + indent) + ' ' + this.y.toFixed(1) + ' Td (' + esc(l) + ') Tj ET');
    }
    this.y -= gap;
  }
  heading(str) {
    this.need(40);
    this.y -= 10;
    this.text(str, { size: 13, bold: true, color: '#0b6e4f' });
    this.rule();
  }
  rule() {
    this.y -= 4;
    this.ops.push(rgb('#cccccc') + ' RG 0.6 w ' + M + ' ' + this.y.toFixed(1) + ' m ' + (W - M) + ' ' + this.y.toFixed(1) + ' l S');
    this.y -= 4;
  }
  // A labelled bar, for small charts.
  bar(label, value, max, color = '#f28c28') {
    const lh = 16;
    this.need(lh);
    this.y -= lh;
    const labelW = 120;
    const full = W - 2 * M - labelW - 40;
    const w = max > 0 ? Math.max(value ? 2 : 0, (value / max) * full) : 0;
    this.ops.push('BT /F1 9 Tf ' + rgb('#222222') + ' rg ' + M + ' ' + (this.y + 3).toFixed(1) + ' Td (' + esc(label) + ') Tj ET');
    if (w) this.ops.push(rgb(color) + ' rg ' + (M + labelW) + ' ' + (this.y + 1).toFixed(1) + ' ' + w.toFixed(1) + ' 10 re f');
    this.ops.push('BT /F2 9 Tf ' + rgb('#222222') + ' rg ' + (M + labelW + w + 6).toFixed(1) + ' ' + (this.y + 3).toFixed(1) + ' Td (' + esc(String(value)) + ') Tj ET');
  }
  // Two columns of label: value pairs.
  facts(pairs) {
    for (let i = 0; i < pairs.length; i += 2) {
      const lh = 15;
      this.need(lh);
      this.y -= lh;
      [pairs[i], pairs[i + 1]].forEach((p, c) => {
        if (!p) return;
        const x = M + c * ((W - 2 * M) / 2);
        this.ops.push('BT /F1 10 Tf ' + rgb('#555555') + ' rg ' + x + ' ' + this.y.toFixed(1) + ' Td (' + esc(p[0] + ': ') + ') Tj /F2 10 Tf ' + rgb('#111111') + ' rg (' + esc(String(p[1])) + ') Tj ET');
      });
    }
  }
  toBuffer() {
    const objs = [];
    const add = (s) => {
      objs.push(s);
      return objs.length;
    };
    const catalog = add(null);
    const pagesObj = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    const total = this.pages.length;
    this.pages.forEach((ops, i) => {
      const footer = 'BT /F1 8 Tf ' + rgb('#888888') + ' rg ' + M + ' 28 Td (' + esc('LeadReplyRadar report - page ' + (i + 1) + ' of ' + total) + ') Tj ET';
      const stream = ops.concat(footer).join('\n');
      const content = add('<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream');
      kids.push(add('<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + content + ' 0 R >>'));
    });
    objs[catalog - 1] = '<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>';
    objs[pagesObj - 1] = '<< /Type /Pages /Kids [' + kids.map((k) => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(Buffer.byteLength(out, 'latin1'));
      out += i + 1 + ' 0 obj\n' + o + '\nendobj\n';
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach((o) => (out += String(o).padStart(10, '0') + ' 00000 n \n'));
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return Buffer.from(out, 'latin1');
  }
}

function tz() {
  return (process.env.REPORT_TZ || 'America/Chicago').trim();
}

function fmt(iso, opts) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz(), ...opts }).format(new Date(iso));
  } catch (e) {
    return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
  }
}

const TOPIC_NAME = { support: 'Support', new_client: 'New clients', follow_up: 'Waiting on you', money: 'Money', meeting: 'Meetings', project: 'Projects', other: 'Other' };

// items: this week's emails (with .ai when sorted). extra: { brief, outreach, leads, calls }
export function buildReport(items, extra = {}) {
  const doc = new Pdf();
  const now = new Date().toISOString();
  doc.text('LeadReplyRadar report', { size: 20, bold: true, color: '#111111' });
  doc.text('Last 7 days of mail · made ' + fmt(now, { dateStyle: 'medium', timeStyle: 'short' }), { size: 10, color: '#666666', gap: 6 });

  const hot = items.filter((m) => m.score >= 80);
  doc.heading('Summary');
  doc.facts([
    ['Emails', items.length],
    ['Hot', hot.length],
    ['Unread', items.filter((m) => m.unread).length],
    ['Need a reply', items.filter((m) => m.score >= 80 || (m.tags || []).includes('Question')).length],
    ['Meetings', items.filter((m) => (m.tags || []).includes('Meeting')).length],
    ['Possible scams', items.filter((m) => (m.tags || []).includes('Check sender')).length],
  ]);

  const sortedAi = items.filter((m) => m.ai);
  if (sortedAi.length) {
    doc.heading('AI sort');
    doc.facts([
      ['Needs your decision', sortedAi.filter((m) => m.ai.category === 'decision').length],
      ['Routine (draft ready)', sortedAi.filter((m) => m.ai.category === 'routine').length],
      ['Noise', sortedAi.filter((m) => m.ai.category === 'noise').length],
      ['Sorted', sortedAi.length + ' of ' + items.length],
    ]);
    const topics = {};
    sortedAi.forEach((m) => (topics[m.ai.topic] = (topics[m.ai.topic] || 0) + 1));
    const max = Math.max(1, ...Object.values(topics));
    doc.y -= 6;
    Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, n]) => doc.bar(TOPIC_NAME[t] || t, n, max, '#2f80ed'));
  }

  doc.heading('Emails per day');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = fmt(d.toISOString(), { year: 'numeric', month: '2-digit', day: '2-digit' });
    days.push({ key, label: fmt(d.toISOString(), { weekday: 'short', month: 'short', day: 'numeric' }), n: 0 });
  }
  items.forEach((m) => {
    const key = fmt(m.date, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const day = days.find((x) => x.key === key);
    if (day) day.n++;
  });
  const dmax = Math.max(1, ...days.map((d) => d.n));
  days.forEach((d) => doc.bar(d.label, d.n, dmax));

  if (hot.length) {
    doc.heading('Hot emails');
    hot.slice(0, 12).forEach((m) => {
      doc.text(m.fromName + ' - ' + m.subject, { size: 10, bold: true });
      doc.text(fmt(m.date, { dateStyle: 'medium', timeStyle: 'short' }) + ' · score ' + m.score + (m.ai && m.ai.summary ? ' · ' + m.ai.summary : ''), { size: 9, color: '#555555', indent: 10, gap: 3 });
    });
  }

  const senders = {};
  items.forEach((m) => {
    const k = (m.fromAddress || m.fromName || '').toLowerCase();
    if (!k) return;
    senders[k] = senders[k] || { name: m.fromName, n: 0, best: 0 };
    senders[k].n++;
    senders[k].best = Math.max(senders[k].best, m.score || 0);
  });
  const top = Object.values(senders).sort((a, b) => b.n - a.n || b.best - a.best).slice(0, 8);
  if (top.length) {
    doc.heading('Top senders');
    const smax = Math.max(1, ...top.map((s) => s.n));
    top.forEach((s) => doc.bar(s.name.slice(0, 24), s.n, smax, '#27ae60'));
  }

  if (extra.brief && extra.brief.todo && extra.brief.todo.length) {
    doc.heading('Plan from your mail');
    if (extra.brief.headline) doc.text(extra.brief.headline, { size: 10, bold: true, gap: 2 });
    extra.brief.todo.forEach((t, i) => doc.text(i + 1 + '. ' + t.task + (t.why ? ' (' + t.why + ')' : ''), { size: 10, indent: 6 }));
  }

  const o = extra.outreach;
  if (o && (o.sequences.length || o.tests.length)) {
    doc.heading('Sequences and A/B tests');
    doc.text('Sent today: ' + o.sentToday + ' of ' + o.dailyLimit, { size: 10, color: '#555555', gap: 4 });
    o.sequences.forEach((s) => {
      doc.text('Sequence: ' + s.name + ' (' + s.status + ')', { size: 10, bold: true });
      doc.text(s.people + ' people · ' + s.sent + ' emails sent · ' + s.opened + ' opened · ' + s.replied + ' replied · ' + s.finished + ' finished all steps', { size: 9, color: '#555555', indent: 10, gap: 3 });
    });
    o.tests.forEach((t) => {
      doc.text('A/B test: ' + t.name + (t.winner ? ' · winner ' + t.winner : ''), { size: 10, bold: true });
      doc.text('A "' + t.subjectA + '": ' + t.A.sent + ' sent, ' + t.A.openRate + '% opened, ' + t.A.replyRate + '% replied', { size: 9, color: '#555555', indent: 10 });
      doc.text('B "' + t.subjectB + '": ' + t.B.sent + ' sent, ' + t.B.openRate + '% opened, ' + t.B.replyRate + '% replied', { size: 9, color: '#555555', indent: 10, gap: 3 });
    });
  }

  if (extra.leads && extra.leads.length) {
    doc.heading('Lead Finder');
    extra.leads.slice(0, 3).forEach((l) => {
      doc.text('"' + l.query + '" · ' + l.results.length + ' leads · ' + fmt(l.at, { dateStyle: 'medium' }), { size: 10, bold: true });
      l.results.slice(0, 10).forEach((r) => doc.text('- ' + r.name + (r.website ? ' · ' + r.website : '') + (r.email ? ' · ' + r.email : '') + (r.phone ? ' · ' + r.phone : ''), { size: 9, indent: 10 }));
      doc.y -= 3;
    });
  }

  if (extra.calls && extra.calls.length) {
    doc.heading('AI calls');
    extra.calls.slice(0, 10).forEach((c) => {
      doc.text((c.name || c.to) + ' · ' + c.status + ' · ' + fmt(c.createdAt, { dateStyle: 'medium', timeStyle: 'short' }), { size: 10, bold: true });
      if (c.summary) doc.text(c.summary, { size: 9, color: '#555555', indent: 10, gap: 3 });
    });
  }

  return doc.toBuffer();
}
