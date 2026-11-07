import { scoreEmail } from './score';

// Sample emails shown until a mailbox is set up on Render.
const now = Date.now();
const h = (n) => new Date(now - n * 3600 * 1000).toISOString();

const raw = [
  { id: 'd1', fromName: 'Stripe', fromAddress: 'notifications@stripe.com', subject: 'Your Stripe account is now closed', text: 'After a routine review of your business we found it presents a high level of risk. If you believe we misunderstood your business, complete the form on your Stripe Dashboard within the next 3 days.', date: h(1), unread: true },
  { id: 'd2', fromName: 'Lucas Martin', company: 'Helio Robotics', fromAddress: 'lucas@heliorobotics.com', subject: 'Re: Delivery partnership', text: "We're interested. Can we schedule a call this week to talk pricing and next steps?", date: h(3), unread: true },
  { id: 'd3', fromName: 'Grace Liu', company: 'Pinnacle HR', fromAddress: 'grace@pinnaclehr.com', subject: 'Re: Your proposal', text: 'Sounds good. Send over the proposal and we can move forward.', date: h(7), unread: true },
  { id: 'd4', fromName: 'Aiko Tanaka', company: 'Kiri Analytics', fromAddress: 'aiko@kirianalytics.com', subject: 'Quick question about setup', text: 'Could you tell me how long setup takes?', date: h(20), unread: false },
  { id: 'd5', fromName: 'Maya Chen', company: 'Lumen Logistics', fromAddress: 'maya@lumenlogistics.com', subject: 'Re: Package routes', text: 'Do you have availability Thursday for a meeting about our Dallas routes?', date: h(30), unread: true },
  { id: 'd6', fromName: 'Tom Becker', company: 'Fernwood Supply', fromAddress: 'tom@fernwoodsupply.com', subject: 'Weekly deals newsletter', text: 'Big sale ends Sunday. Unsubscribe or manage preferences below.', date: h(50), unread: false },
  { id: 'd7', fromName: 'Stripe Support', fromAddress: 'alerts@stripe-billing-help.net', subject: 'Urgent: verify your account', text: 'Your account is suspended. Verify your details immediately.', date: h(75), unread: false },
  { id: 'd8', fromName: 'Render', fromAddress: 'no-reply@render.com', subject: 'Deploy failed for encompass-app', text: 'Your deploy failed. Action required.', date: h(100), unread: false },
];

export function demoEmails() {
  return raw.map((m) => ({
    ...m,
    account: 'demo',
    preview: m.text.slice(0, 160),
    link: null,
    ...scoreEmail(m),
  }));
}
