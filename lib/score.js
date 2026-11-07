// Scores an email 0-100 for "needs a quick reply" and gives it tags.
// 80+ is Hot: it beeps until you look at it.

const URGENT_SENDERS = [
  'stripe', 'paypal', 'squareup', 'square', 'bank', 'chase', 'wellsfargo', 'wells fargo',
  'capitalone', 'capital one', 'citi', 'irs.gov', 'irs', 'comptroller', 'render.com',
  'supabase', 'github', 'ionos', 'checkr', 'twilio', 'apple', 'google', 'amazon',
  'attorney', 'legal', 'court', 'insurance',
];

const URGENT_PHRASES = [
  'within 3 days', 'within three days', 'within 24 hours', 'within 48 hours', 'within 7 days',
  'immediate', 'immediately', 'urgent', 'action required', 'action needed', 'response required',
  'account is now closed', 'account closed', 'account has been closed', 'suspended', 'high risk',
  'past due', 'overdue', 'final notice', 'deadline', 'due date', 'payment failed',
  'payment declined', 'dispute', 'chargeback', 'terminated', 'deactivated', 'disabled',
  'verify your', 'review of your', 'complete the form', 'respond by', 'expires', 'expiring',
  'last chance to respond', 'legal', 'lawsuit', 'subpoena', 'violation',
];

const MEETING_WORDS = ['meeting', 'schedule a call', 'hop on a call', 'calendar', 'availability', 'zoom', 'book a time', 'demo'];
const INTEREST_WORDS = ['interested', 'sounds good', "let's do", 'lets do', 'quote', 'pricing', 'hire you', 'proposal', 'sign up', 'next steps', 'move forward'];
const QUESTION_WORDS = ['can you', 'could you', 'would you', 'please let me know', 'any update', 'do you', 'are you able', 'what is', 'how do'];
const BULK_WORDS = ['unsubscribe', 'newsletter', 'view in browser', 'manage preferences', 'promo', '% off', 'sale ends', 'webinar'];

const BRAND_DOMAINS = {
  stripe: ['stripe.com'],
  paypal: ['paypal.com'],
  square: ['squareup.com', 'square.com'],
  chase: ['chase.com'],
  'wells fargo': ['wellsfargo.com'],
  irs: ['irs.gov'],
  github: ['github.com'],
  apple: ['apple.com'],
  amazon: ['amazon.com'],
};

function has(text, words) {
  return words.filter((w) => text.includes(w));
}

export function scoreEmail({ fromName = '', fromAddress = '', subject = '', text = '' }) {
  const from = (fromName + ' ' + fromAddress).toLowerCase();
  const subj = subject.toLowerCase();
  const body = text.toLowerCase().slice(0, 4000);
  const all = subj + ' ' + body;

  let score = 20;
  const tags = [];
  const reasons = [];

  const senderHits = has(from, URGENT_SENDERS);
  const urgentHits = has(all, URGENT_PHRASES);
  const meetingHits = has(all, MEETING_WORDS);
  const interestHits = has(all, INTEREST_WORDS);
  const questionHits = has(all, QUESTION_WORDS);
  const bulkHits = has(all, BULK_WORDS);

  if (senderHits.length) {
    score += 20;
    reasons.push('Important sender');
  }
  if (urgentHits.length) {
    score += Math.min(45, 25 + urgentHits.length * 7);
    tags.push('Account');
    reasons.push('Deadline or account notice: "' + urgentHits[0] + '"');
  }
  if (/^\s*(re|fw|fwd)\s*:/i.test(subject)) {
    score += 15;
    reasons.push('Reply to your email');
  }
  if (meetingHits.length) {
    score += 20;
    tags.push('Meeting');
  }
  if (interestHits.length) {
    score += 20;
    tags.push('Interested');
  }
  if (subject.includes('?') || questionHits.length) {
    score += 10;
    tags.push('Question');
  }
  // A real person (not a no-reply robot or bulk sender) counts a bit more.
  if (!/no-?reply|notifications?@|mailer|newsletter|marketing|info@|news@/.test(from) && !bulkHits.length) {
    score += 10;
  }
  // Bulk mail is pushed down unless it's an account or deadline notice.
  if (bulkHits.length && !urgentHits.length) {
    score -= 35;
    tags.push('Unsubscribe');
  }

  // Scam check: a name like "Stripe" sent from a domain that isn't Stripe's.
  const domain = (fromAddress.split('@')[1] || '').toLowerCase();
  for (const [brand, domains] of Object.entries(BRAND_DOMAINS)) {
    if ((fromName.toLowerCase().includes(brand) || subj.includes(brand)) && domain) {
      const okDomain = domains.some((d) => domain === d || domain.endsWith('.' + d));
      if (fromName.toLowerCase().includes(brand) && !okDomain) {
        tags.push('Check sender');
        reasons.push('Name says ' + brand + ' but it came from ' + domain);
      }
    }
  }

  score = Math.max(0, Math.min(100, score));
  if (score >= 80) tags.unshift('Hot');

  return { score, tags: [...new Set(tags)], reasons };
}

export function band(score) {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'mid';
  if (score >= 30) return 'low';
  return 'cold';
}
