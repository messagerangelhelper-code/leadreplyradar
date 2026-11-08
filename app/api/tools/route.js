import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { isAuthed, passwordIsSet } from '../../../lib/auth';
import { mailboxes, readAllMail } from '../../../lib/imap';
import { aiFor, aiIsSet, lastBrief } from '../../../lib/ai';
import { changeOutreach, outreachStatus, readToken, recordOpen, startAbTest, startSequence } from '../../../lib/outreach';
import { deleteLeadList, leadJob, leadLists, leadsCsv, startLeadSearch } from '../../../lib/leads';
import { callList, callsIsSet, handleVoice, phonesFromMail, startCall, twilioSignatureOk } from '../../../lib/calls';
import { buildReport } from '../../../lib/pdf';
import { loadStore, storeStatus } from '../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The 5 tools on the Tools page: Lead Finder, Sequences, PDF Reports, A/B Subject Lines, AI Calling Agent.
// Nothing is emailed or called unless you press the button and confirm.
// Two parts of this file work without the dashboard sign-in:
//   GET  ?k=...       the 1x1 picture that counts email opens (the link is signed by the app)
//   POST ?c=...&s=... Twilio during an AI call (must carry Twilio's signature, made with your TWILIO_AUTH_TOKEN)
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
async function openPixel(k) {
  const payload = readToken(k);
  if (payload) {
    try {
      await loadStore();
      recordOpen(payload);
    } catch (e) {}
  }
  return new Response(GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Content-Length': String(GIF.length) },
  });
}
async function twilioWebhook(request) {
  const params = {};
  try {
    const form = await request.formData();
    for (const [k, v] of form.entries()) params[k] = String(v);
  } catch (e) {}
  const base = String(process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '').replace(/\/+$/, '');
  const url = base + request.nextUrl.pathname + request.nextUrl.search;
  if (!twilioSignatureOk(url, params, request.headers.get('x-twilio-signature'))) {
    console.error('LeadReplyRadar call webhook: bad Twilio signature');
    return new Response('Forbidden', { status: 403 });
  }
  const id = request.nextUrl.searchParams.get('c') || '';
  const step = request.nextUrl.searchParams.get('s') || '';
  try {
    const xml = await handleVoice(id, step, params);
    if (step === 'status') return new Response(null, { status: 204 });
    return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (e) {
    console.error('LeadReplyRadar call webhook error: ' + String(e.message || e).slice(0, 150));
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong. Goodbye.</Say><Hangup/></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
function deny() {
  return NextResponse.json({ ok: false, error: 'Sign in to the dashboard first.' }, { status: 401 });
}
async function mailWithAi() {
  const data = await readAllMail();
  return (data.items || []).map((m) => {
    const ai = aiFor(m.id);
    return ai ? { ...m, ai } : m;
  });
}
async function reportPdf() {
  const items = await mailWithAi();
  const [outreach, leads, calls] = await Promise.all([outreachStatus(), leadLists(), callList()]);
  return buildReport(items, { brief: lastBrief(), outreach, leads, calls });
}
function fileName(ext) {
  return 'LeadReplyRadar-report-' + new Date().toISOString().slice(0, 10) + '.' + ext;
}
export async function GET(request) {
  const k = request.nextUrl.searchParams.get('k');
  if (k) return openPixel(k);
  if (!passwordIsSet() || !isAuthed(request)) return deny();
  if (!mailboxes().length) return NextResponse.json({ ok: false, error: 'Add MAIL1_USER and MAIL1_PASS on Render first.' }, { status: 400 });
  const action = request.nextUrl.searchParams.get('action') || 'status';
  try {
    if (action === 'pdf') {
      const buf = await reportPdf();
      return new Response(buf, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + fileName('pdf') + '"', 'Cache-Control': 'no-store' },
      });
    }
    if (action === 'csv') {
      const id = request.nextUrl.searchParams.get('id');
      const list = (await leadLists()).find((l) => l.id === id);
      if (!list) return NextResponse.json({ ok: false, error: 'That lead list is gone.' }, { status: 404 });
      return new Response(leadsCsv(list), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-' + list.at.slice(0, 10) + '.csv"', 'Cache-Control': 'no-store' },
      });
    }
    await loadStore().catch(() => {});
    const data = await readAllMail();
    const [outreach, leads, calls] = await Promise.all([outreachStatus(), leadLists(), callList()]);
    return NextResponse.json({
      ok: true,
      store: storeStatus(),
      ai: aiIsSet(),
      outreach,
      leads,
      leadJob: leadJob(),
      calls,
      callsOn: callsIsSet(),
      phones: phonesFromMail(data.items || [], aiFor),
    });
  } catch (e) {
    console.error('LeadReplyRadar tools error: ' + String(e.message || e));
    return NextResponse.json({ ok: false, error: String(e.message || e).slice(0, 200) }, { status: 500 });
  }
}
export async function POST(request) {
  if (request.nextUrl.searchParams.get('c')) return twilioWebhook(request);
  if (!passwordIsSet() || !isAuthed(request)) return deny();
  if (!mailboxes().length) return NextResponse.json({ ok: false, error: 'Add MAIL1_USER and MAIL1_PASS on Render first.' }, { status: 400 });
  let body = {};
  try {
    body = await request.json();
  } catch (e) {}
  try {
    switch (body.action) {
      case 'seq_start':
        return NextResponse.json({ ok: true, ...(await startSequence(body)) });
      case 'ab_start':
        return NextResponse.json({ ok: true, ...(await startAbTest(body)) });
      case 'outreach_change':
        await changeOutreach(body.kind, body.id, body.what);
        return NextResponse.json({ ok: true });
      case 'leads_find':
        return NextResponse.json({ ok: true, job: startLeadSearch(body.query, body.count) });
      case 'leads_delete':
        await deleteLeadList(body.id);
        return NextResponse.json({ ok: true });
      case 'call_start': {
        const data = await readAllMail();
        const call = await startCall(body, data.items || [], aiFor);
        return NextResponse.json({ ok: true, call });
      }
      case 'pdf_email': {
        // Emails the report to YOUR OWN address only.
        const b = mailboxes()[0];
        const buf = await reportPdf();
        const host = (process.env.MAIL1_SMTP_HOST || b.host.replace(/^imap\./i, 'smtp.')).trim();
        const tx = nodemailer.createTransport({ host, port: 465, secure: true, auth: { user: b.user, pass: b.pass }, connectionTimeout: 15000, socketTimeout: 30000 });
        await tx.sendMail({
          from: b.user,
          to: b.user,
          subject: 'LeadReplyRadar report ' + new Date().toISOString().slice(0, 10),
          text: 'Your LeadReplyRadar report is attached.',
          attachments: [{ filename: fileName('pdf'), content: buf, contentType: 'application/pdf' }],
        });
        return NextResponse.json({ ok: true, to: b.user });
      }
      default:
        return NextResponse.json({ ok: false, error: 'Unknown button.' }, { status: 400 });
    }
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error('LeadReplyRadar tools error: ' + msg);
    const nice = /auth|535|534|credentials/i.test(msg) ? 'Gmail would not let the app send. Check MAIL1_PASS is your Gmail app password.' : msg.slice(0, 200);
    return NextResponse.json({ ok: false, error: nice }, { status: 400 });
  }
}
