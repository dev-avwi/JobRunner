/**
 * Webhook signature rejection tests.
 *
 * Posts forged-signature payloads to each verified webhook surface and asserts
 * the route returns HTTP 401 (i.e. side effects are gated on signature check).
 *
 * Run against the dev server:
 *   BASE_URL=http://localhost:5000 tsx tests/webhook-signatures.test.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface Case {
  name: string;
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: string;
}

const cases: Case[] = [
  {
    name: 'SendGrid webhook rejects bad ECDSA signature',
    url: '/api/webhooks/sendgrid',
    headers: {
      'content-type': 'application/json',
      'x-twilio-email-event-webhook-signature': 'AAAAINVALIDSIG',
      'x-twilio-email-event-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body: JSON.stringify([{ event: 'delivered', email: 't@t.com' }]),
  },
  {
    name: 'Xero webhook rejects bad HMAC signature',
    url: '/api/webhooks/xero',
    headers: {
      'content-type': 'application/json',
      'x-xero-signature': 'aW52YWxpZHNpZ25hdHVyZXdyb25nbGVuZ3RoYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    },
    body: JSON.stringify({ events: [] }),
  },
  {
    name: 'Apple IAP webhook rejects unsigned/forged JWS',
    url: '/api/iap/apple-notifications',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // Forged JWS: header + payload base64url, garbage signature, no x5c chain.
      signedPayload:
        Buffer.from('{"alg":"ES256"}').toString('base64url') +
        '.' +
        Buffer.from('{"data":{"bundleId":"com.jobrunner.app"}}').toString('base64url') +
        '.AAAA',
    }),
  },
];

async function run() {
  let failed = 0;
  for (const c of cases) {
    let status = 0;
    let bodyText = '';
    try {
      const r = await fetch(`${BASE_URL}${c.url}`, {
        method: c.method || 'POST',
        headers: c.headers,
        body: c.body,
      });
      status = r.status;
      bodyText = await r.text();
    } catch (e: any) {
      console.error(`✗ ${c.name} — request error: ${e?.message}`);
      failed++;
      continue;
    }
    if (status === 401) {
      console.log(`✓ ${c.name} → 401`);
    } else {
      failed++;
      console.error(`✗ ${c.name} → expected 401 got ${status}: ${bodyText.slice(0, 200)}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll webhook signature rejection tests passed.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
