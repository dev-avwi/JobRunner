/**
 * Balanced Trade-Specific Templates
 * 
 * Structure: 3 quotes, 3 invoices, 3 jobs per trade
 * Trades: electrical, plumbing, carpentry, landscaping, painting, hvac, roofing, tiling, general
 * Total: 9 templates per trade × 9 trades = 81 templates (balanced and manageable)
 */

// Helper to create consistent template structure
const createTemplate = (
  type: 'quote' | 'invoice' | 'job',
  tradeType: string,
  familyKey: string,
  name: string,
  brandColor: string,
  title: string,
  description: string,
  terms: string,
  depositPct: number,
  dueTermDays: number,
  defaultLineItems: Array<{ description: string; qty: number; unitPrice: number; unit: string }>
) => ({
  type,
  familyKey,
  name,
  tradeType,
  styling: { brandColor, logoDisplay: true },
  sections: {
    showHeader: true,
    showLineItems: true,
    showTotals: true,
    showTerms: true,
    showSignature: true
  },
  defaults: {
    title,
    description,
    terms,
    depositPct,
    dueTermDays,
    gstEnabled: true
  },
  defaultLineItems
});

export const tradieQuoteTemplates = [
  // ============================================
  // ELECTRICAL (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'electrical', 'electrical-standard', 'Standard Electrical Quote',
    '#dc2626', 'Electrical Services Quote', 'Licensed electrical work for your property',
    'Quote valid for 30 days. All electrical work complies with AS/NZS 3000:2018. Certificate of electrical safety provided. GST included.',
    50, 30, [
      { description: 'Labour - Licensed electrician', qty: 1, unitPrice: 135.00, unit: 'hour' },
      { description: 'Call-out fee', qty: 1, unitPrice: 90.00, unit: 'flat' }
    ]),
  createTemplate('quote', 'electrical', 'electrical-switchboard', 'Switchboard Upgrade Quote',
    '#dc2626', 'Switchboard Upgrade Quote', 'Complete switchboard replacement with safety switches',
    'Quote valid for 30 days. Work requires power disconnection. Certificate of electrical safety included. 12-month workmanship guarantee. GST included.',
    60, 30, [
      { description: 'New switchboard with safety switches', qty: 1, unitPrice: 1200.00, unit: 'each' },
      { description: 'Installation labour', qty: 6, unitPrice: 135.00, unit: 'hour' }
    ]),
  createTemplate('quote', 'electrical', 'electrical-lighting', 'Lighting Installation Quote',
    '#dc2626', 'Lighting Installation Quote', 'LED lighting upgrade and installation',
    'Quote valid for 30 days. All LED fittings included. Certificate of compliance provided. GST included.',
    50, 30, [
      { description: 'LED downlight supply and install', qty: 6, unitPrice: 85.00, unit: 'each' },
      { description: 'Wiring and connection', qty: 2, unitPrice: 135.00, unit: 'hour' }
    ]),
  createTemplate('invoice', 'electrical', 'electrical-standard-inv', 'Standard Electrical Invoice',
    '#dc2626', 'Electrical Services Invoice', 'Invoice for electrical work completed',
    'Payment due within 14 days. All work guaranteed for 12 months. Certificate of electrical safety attached.',
    0, 14, [
      { description: 'Labour - Licensed electrician', qty: 1, unitPrice: 135.00, unit: 'hour' },
      { description: 'Materials', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('invoice', 'electrical', 'electrical-switchboard-inv', 'Switchboard Invoice',
    '#dc2626', 'Switchboard Upgrade Invoice', 'Invoice for switchboard replacement',
    'Payment due within 14 days. Certificate of electrical safety attached. 12-month guarantee.',
    0, 14, [
      { description: 'Switchboard upgrade complete', qty: 1, unitPrice: 1800.00, unit: 'job' },
      { description: 'Additional circuits', qty: 1, unitPrice: 0, unit: 'each' }
    ]),
  createTemplate('invoice', 'electrical', 'electrical-lighting-inv', 'Lighting Invoice',
    '#dc2626', 'Lighting Installation Invoice', 'Invoice for lighting installation',
    'Payment due within 14 days. All fittings covered by manufacturer warranty.',
    0, 14, [
      { description: 'LED lighting installation complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'electrical', 'electrical-standard-job', 'Standard Electrical Job',
    '#dc2626', 'Electrical Service', 'General electrical work',
    'All work to AS/NZS 3000:2018. Certificate provided on completion.',
    0, 14, [
      { description: 'Electrical work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'electrical', 'electrical-switchboard-job', 'Switchboard Upgrade Job',
    '#dc2626', 'Switchboard Upgrade', 'Replace old switchboard with modern unit',
    'Power will be disconnected during work. Certificate provided.',
    0, 14, [
      { description: 'Switchboard replacement', qty: 1, unitPrice: 1800.00, unit: 'job' }
    ]),
  createTemplate('job', 'electrical', 'electrical-lighting-job', 'Lighting Installation Job',
    '#dc2626', 'Lighting Installation', 'Install new light fittings',
    'All LED products included. Clean up after completion.',
    0, 14, [
      { description: 'Lighting installation', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // PLUMBING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'plumbing', 'plumbing-standard', 'Standard Plumbing Quote',
    '#2563eb', 'Plumbing Services Quote', 'Professional plumbing services for your property',
    'Quote valid for 30 days. 50% deposit required to commence work. All work guaranteed for 12 months. GST included.',
    50, 30, [
      { description: 'Labour - Plumbing services', qty: 1, unitPrice: 120.00, unit: 'hour' },
      { description: 'Call-out fee', qty: 1, unitPrice: 80.00, unit: 'flat' }
    ]),
  createTemplate('quote', 'plumbing', 'plumbing-hotwater', 'Hot Water System Quote',
    '#2563eb', 'Hot Water System Quote', 'Supply and install new hot water system',
    'Quote valid for 30 days. 5-year manufacturer warranty. Installation guaranteed for 12 months. Old unit disposal included. GST included.',
    40, 30, [
      { description: 'Electric hot water system (315L)', qty: 1, unitPrice: 1200.00, unit: 'each' },
      { description: 'Installation labour', qty: 4, unitPrice: 120.00, unit: 'hour' },
      { description: 'Old system disposal', qty: 1, unitPrice: 150.00, unit: 'flat' }
    ]),
  createTemplate('quote', 'plumbing', 'plumbing-bathroom', 'Bathroom Renovation Quote',
    '#2563eb', 'Bathroom Plumbing Quote', 'Complete bathroom plumbing renovation',
    'Quote valid for 45 days. Progress payments: 30% deposit, 40% rough-in, 30% completion. Waterproofing certificate provided. GST included.',
    30, 45, [
      { description: 'Bathroom strip out and rough-in', qty: 1, unitPrice: 850.00, unit: 'job' },
      { description: 'Toilet installation', qty: 1, unitPrice: 280.00, unit: 'each' },
      { description: 'Vanity and basin installation', qty: 1, unitPrice: 420.00, unit: 'each' }
    ]),
  createTemplate('invoice', 'plumbing', 'plumbing-standard-inv', 'Standard Plumbing Invoice',
    '#2563eb', 'Plumbing Services Invoice', 'Invoice for plumbing work completed',
    'Payment due within 14 days. All work guaranteed for 12 months.',
    0, 14, [
      { description: 'Labour - Plumbing services', qty: 1, unitPrice: 120.00, unit: 'hour' },
      { description: 'Materials', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('invoice', 'plumbing', 'plumbing-hotwater-inv', 'Hot Water System Invoice',
    '#2563eb', 'Hot Water Installation Invoice', 'Invoice for hot water system installation',
    'Payment due within 14 days. Manufacturer warranty details attached. Keep for your records.',
    0, 14, [
      { description: 'Hot water system complete installation', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'plumbing', 'plumbing-bathroom-inv', 'Bathroom Renovation Invoice',
    '#2563eb', 'Bathroom Plumbing Invoice', 'Invoice for bathroom plumbing work',
    'Payment due within 14 days. Waterproofing certificate attached.',
    0, 14, [
      { description: 'Bathroom plumbing complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'plumbing', 'plumbing-standard-job', 'Standard Plumbing Job',
    '#2563eb', 'Plumbing Service', 'General plumbing work',
    'All work to Australian plumbing standards. Guarantee provided.',
    0, 14, [
      { description: 'Plumbing work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'plumbing', 'plumbing-hotwater-job', 'Hot Water System Job',
    '#2563eb', 'Hot Water Installation', 'Install new hot water system',
    'Old unit disposal included. Compliance certificate provided.',
    0, 14, [
      { description: 'Hot water installation', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'plumbing', 'plumbing-bathroom-job', 'Bathroom Renovation Job',
    '#2563eb', 'Bathroom Plumbing', 'Bathroom plumbing renovation',
    'Waterproofing certificate provided. Full cleanup after work.',
    0, 14, [
      { description: 'Bathroom renovation plumbing', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // CARPENTRY/BUILDING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'carpentry', 'carpentry-standard', 'Standard Carpentry Quote',
    '#ea580c', 'Carpentry Services Quote', 'Quality carpentry and building services',
    'Quote valid for 30 days. Materials and labour included. All timber work guaranteed. GST included.',
    30, 30, [
      { description: 'Labour - Qualified carpenter', qty: 1, unitPrice: 85.00, unit: 'hour' },
      { description: 'Materials', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('quote', 'carpentry', 'carpentry-deck', 'Deck Construction Quote',
    '#ea580c', 'Deck Construction Quote', 'New timber deck construction',
    'Quote valid for 45 days. All timber treated and guaranteed. Council approval assistance if required. GST included.',
    30, 45, [
      { description: 'Deck construction (hardwood)', qty: 1, unitPrice: 280.00, unit: 'sqm' },
      { description: 'Footings and bearers', qty: 1, unitPrice: 0, unit: 'lot' },
      { description: 'Handrails and stairs', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('quote', 'carpentry', 'carpentry-pergola', 'Pergola Construction Quote',
    '#ea580c', 'Pergola Construction Quote', 'Custom pergola build',
    'Quote valid for 30 days. Design consultation included. All hardware and timber included. GST included.',
    30, 30, [
      { description: 'Pergola construction', qty: 1, unitPrice: 220.00, unit: 'sqm' },
      { description: 'Posts and footings', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('invoice', 'carpentry', 'carpentry-standard-inv', 'Standard Carpentry Invoice',
    '#ea580c', 'Carpentry Services Invoice', 'Invoice for carpentry work completed',
    'Payment due within 14 days. All work guaranteed.',
    0, 14, [
      { description: 'Carpentry work complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'carpentry', 'carpentry-deck-inv', 'Deck Construction Invoice',
    '#ea580c', 'Deck Construction Invoice', 'Invoice for deck construction',
    'Payment due within 14 days. Timber warranty information attached.',
    0, 14, [
      { description: 'Deck construction complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'carpentry', 'carpentry-pergola-inv', 'Pergola Invoice',
    '#ea580c', 'Pergola Construction Invoice', 'Invoice for pergola construction',
    'Payment due within 14 days. Maintenance tips attached.',
    0, 14, [
      { description: 'Pergola construction complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'carpentry', 'carpentry-standard-job', 'Standard Carpentry Job',
    '#ea580c', 'Carpentry Work', 'General carpentry services',
    'Quality workmanship guaranteed. Site left clean.',
    0, 14, [
      { description: 'Carpentry work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'carpentry', 'carpentry-deck-job', 'Deck Construction Job',
    '#ea580c', 'Deck Build', 'Construct new timber deck',
    'All council requirements to be met. Cleanup included.',
    0, 14, [
      { description: 'Deck construction', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'carpentry', 'carpentry-pergola-job', 'Pergola Construction Job',
    '#ea580c', 'Pergola Build', 'Construct new pergola',
    'All materials and cleanup included.',
    0, 14, [
      { description: 'Pergola construction', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // PAINTING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'painting', 'painting-standard', 'Standard Painting Quote',
    '#7c3aed', 'Painting Services Quote', 'Professional painting and decorating',
    'Quote valid for 30 days. Premium paint included. All prep work included. GST included.',
    30, 30, [
      { description: 'Interior painting (2 coats)', qty: 1, unitPrice: 22.00, unit: 'sqm' },
      { description: 'Preparation and primer', qty: 1, unitPrice: 8.00, unit: 'sqm' }
    ]),
  createTemplate('quote', 'painting', 'painting-exterior', 'Exterior Painting Quote',
    '#7c3aed', 'Exterior Painting Quote', 'Full exterior repaint',
    'Quote valid for 30 days. High-pressure cleaning included. Weather-resistant paint. 5-year guarantee. GST included.',
    30, 30, [
      { description: 'Exterior painting', qty: 1, unitPrice: 28.00, unit: 'sqm' },
      { description: 'High-pressure cleaning', qty: 1, unitPrice: 12.00, unit: 'sqm' },
      { description: 'Trim and windows', qty: 1, unitPrice: 25.00, unit: 'lineal metre' }
    ]),
  createTemplate('quote', 'painting', 'painting-fullhouse', 'Full House Repaint Quote',
    '#7c3aed', 'Full House Repaint Quote', 'Complete interior and exterior repaint',
    'Quote valid for 45 days. Premium paint throughout. All furniture protected. GST included.',
    30, 45, [
      { description: 'Interior - walls and ceilings', qty: 1, unitPrice: 0, unit: 'lot' },
      { description: 'Exterior - complete', qty: 1, unitPrice: 0, unit: 'lot' },
      { description: 'Doors, trims and windows', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('invoice', 'painting', 'painting-standard-inv', 'Standard Painting Invoice',
    '#7c3aed', 'Painting Services Invoice', 'Invoice for painting work completed',
    'Payment due within 14 days. Touch-up included within 30 days.',
    0, 14, [
      { description: 'Painting work complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'painting', 'painting-exterior-inv', 'Exterior Painting Invoice',
    '#7c3aed', 'Exterior Painting Invoice', 'Invoice for exterior painting',
    'Payment due within 14 days. 5-year guarantee on workmanship.',
    0, 14, [
      { description: 'Exterior painting complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'painting', 'painting-fullhouse-inv', 'Full House Repaint Invoice',
    '#7c3aed', 'Full House Repaint Invoice', 'Invoice for complete house repaint',
    'Payment due within 14 days. Paint warranty information attached.',
    0, 14, [
      { description: 'Full house repaint complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'painting', 'painting-standard-job', 'Standard Painting Job',
    '#7c3aed', 'Painting Work', 'Interior/exterior painting',
    'All prep and cleanup included. Furniture protected.',
    0, 14, [
      { description: 'Painting work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'painting', 'painting-exterior-job', 'Exterior Painting Job',
    '#7c3aed', 'Exterior Painting', 'Complete exterior repaint',
    'High-pressure wash included. Weather permitting.',
    0, 14, [
      { description: 'Exterior painting', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'painting', 'painting-fullhouse-job', 'Full House Repaint Job',
    '#7c3aed', 'Full House Repaint', 'Complete house repaint inside and out',
    'Premium paint used. All rooms completed.',
    0, 14, [
      { description: 'Full house repaint', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // HVAC / AIR CONDITIONING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'hvac', 'hvac-standard', 'Standard HVAC Quote',
    '#0891b2', 'HVAC Services Quote', 'Air conditioning service and repairs',
    'Quote valid for 30 days. All parts and labour included. 12-month guarantee. GST included.',
    50, 30, [
      { description: 'HVAC service call', qty: 1, unitPrice: 180.00, unit: 'flat' },
      { description: 'Labour', qty: 1, unitPrice: 95.00, unit: 'hour' }
    ]),
  createTemplate('quote', 'hvac', 'hvac-split', 'Split System Installation Quote',
    '#0891b2', 'Split System Installation Quote', 'Supply and install split system air conditioner',
    'Quote valid for 30 days. 5-year manufacturer warranty. Installation guaranteed. Electrical certificate included. GST included.',
    40, 30, [
      { description: 'Split system unit (7kW)', qty: 1, unitPrice: 2800.00, unit: 'each' },
      { description: 'Installation labour', qty: 1, unitPrice: 650.00, unit: 'flat' },
      { description: 'Piping and bracket', qty: 1, unitPrice: 350.00, unit: 'lot' }
    ]),
  createTemplate('quote', 'hvac', 'hvac-ducted', 'Ducted System Quote',
    '#0891b2', 'Ducted Air Conditioning Quote', 'Complete ducted system installation',
    'Quote valid for 45 days. Includes zone control. Ductwork and installation included. GST included.',
    30, 45, [
      { description: 'Ducted system complete', qty: 1, unitPrice: 8500.00, unit: 'each' },
      { description: 'Zone controller', qty: 1, unitPrice: 1200.00, unit: 'each' }
    ]),
  createTemplate('invoice', 'hvac', 'hvac-standard-inv', 'Standard HVAC Invoice',
    '#0891b2', 'HVAC Services Invoice', 'Invoice for HVAC service',
    'Payment due within 14 days. Parts warranty information attached.',
    0, 14, [
      { description: 'HVAC service complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'hvac', 'hvac-split-inv', 'Split System Invoice',
    '#0891b2', 'Split System Installation Invoice', 'Invoice for split system installation',
    'Payment due within 14 days. Warranty registration details attached.',
    0, 14, [
      { description: 'Split system installation complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'hvac', 'hvac-ducted-inv', 'Ducted System Invoice',
    '#0891b2', 'Ducted System Invoice', 'Invoice for ducted system installation',
    'Payment due within 14 days. User manual and warranty information attached.',
    0, 14, [
      { description: 'Ducted system installation complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'hvac', 'hvac-standard-job', 'Standard HVAC Job',
    '#0891b2', 'HVAC Service', 'Air conditioning service or repair',
    'All parts and labour guaranteed.',
    0, 14, [
      { description: 'HVAC service', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'hvac', 'hvac-split-job', 'Split System Installation Job',
    '#0891b2', 'Split System Install', 'Install new split system',
    'Includes electrical work and bracket.',
    0, 14, [
      { description: 'Split system installation', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'hvac', 'hvac-ducted-job', 'Ducted System Job',
    '#0891b2', 'Ducted System Install', 'Install complete ducted system',
    'Full installation with zones.',
    0, 14, [
      { description: 'Ducted system installation', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // ROOFING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'roofing', 'roofing-standard', 'Standard Roofing Quote',
    '#374151', 'Roofing Services Quote', 'Professional roofing repairs and maintenance',
    'Quote valid for 30 days. All work guaranteed for 12 months. Safety-compliant work. GST included.',
    50, 30, [
      { description: 'Roof inspection', qty: 1, unitPrice: 180.00, unit: 'flat' },
      { description: 'Labour - Roofing', qty: 1, unitPrice: 95.00, unit: 'hour' }
    ]),
  createTemplate('quote', 'roofing', 'roofing-restoration', 'Roof Restoration Quote',
    '#374151', 'Roof Restoration Quote', 'Complete roof restoration',
    'Quote valid for 45 days. High-pressure cleaning, repairs, and coating included. 10-year warranty. GST included.',
    30, 45, [
      { description: 'High-pressure roof cleaning', qty: 1, unitPrice: 8.00, unit: 'sqm' },
      { description: 'Repointing and repairs', qty: 1, unitPrice: 0, unit: 'lot' },
      { description: 'Roof coating (2 coats)', qty: 1, unitPrice: 18.00, unit: 'sqm' }
    ]),
  createTemplate('quote', 'roofing', 'roofing-replacement', 'Roof Replacement Quote',
    '#374151', 'Roof Replacement Quote', 'Complete roof replacement',
    'Quote valid for 60 days. Old roof disposal included. All flashings and fixtures. Building certificate provided. GST included.',
    30, 60, [
      { description: 'Old roof removal and disposal', qty: 1, unitPrice: 0, unit: 'lot' },
      { description: 'New roof installation (Colorbond)', qty: 1, unitPrice: 120.00, unit: 'sqm' },
      { description: 'Flashings and gutters', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('invoice', 'roofing', 'roofing-standard-inv', 'Standard Roofing Invoice',
    '#374151', 'Roofing Services Invoice', 'Invoice for roofing work',
    'Payment due within 14 days. Work guaranteed for 12 months.',
    0, 14, [
      { description: 'Roofing work complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'roofing', 'roofing-restoration-inv', 'Roof Restoration Invoice',
    '#374151', 'Roof Restoration Invoice', 'Invoice for roof restoration',
    'Payment due within 14 days. 10-year warranty certificate attached.',
    0, 14, [
      { description: 'Roof restoration complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'roofing', 'roofing-replacement-inv', 'Roof Replacement Invoice',
    '#374151', 'Roof Replacement Invoice', 'Invoice for roof replacement',
    'Payment due within 14 days. Building certificate attached.',
    0, 14, [
      { description: 'Roof replacement complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'roofing', 'roofing-standard-job', 'Standard Roofing Job',
    '#374151', 'Roofing Work', 'Roof repairs and maintenance',
    'Safety-compliant work. All debris removed.',
    0, 14, [
      { description: 'Roofing work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'roofing', 'roofing-restoration-job', 'Roof Restoration Job',
    '#374151', 'Roof Restoration', 'Complete roof restoration',
    'Clean, repair and coat roof.',
    0, 14, [
      { description: 'Roof restoration', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'roofing', 'roofing-replacement-job', 'Roof Replacement Job',
    '#374151', 'Roof Replacement', 'Replace entire roof',
    'Full roof replacement with certificate.',
    0, 14, [
      { description: 'Roof replacement', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // TILING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'tiling', 'tiling-standard', 'Standard Tiling Quote',
    '#ca8a04', 'Tiling Services Quote', 'Professional floor and wall tiling',
    'Quote valid for 30 days. All tiles and materials included. Waterproofing where required. GST included.',
    30, 30, [
      { description: 'Floor tiling installation', qty: 1, unitPrice: 65.00, unit: 'sqm' },
      { description: 'Tile supply', qty: 1, unitPrice: 0, unit: 'sqm' }
    ]),
  createTemplate('quote', 'tiling', 'tiling-bathroom', 'Bathroom Tiling Quote',
    '#ca8a04', 'Bathroom Tiling Quote', 'Complete bathroom tiling with waterproofing',
    'Quote valid for 30 days. Waterproofing certificate provided. All grouting and silicone included. GST included.',
    30, 30, [
      { description: 'Bathroom floor and wall tiling', qty: 1, unitPrice: 75.00, unit: 'sqm' },
      { description: 'Waterproofing', qty: 1, unitPrice: 45.00, unit: 'sqm' },
      { description: 'Tile supply (premium)', qty: 1, unitPrice: 0, unit: 'sqm' }
    ]),
  createTemplate('quote', 'tiling', 'tiling-outdoor', 'Outdoor Tiling Quote',
    '#ca8a04', 'Outdoor Tiling Quote', 'Patio and outdoor area tiling',
    'Quote valid for 30 days. Slip-resistant tiles recommended. All prep work included. GST included.',
    30, 30, [
      { description: 'Outdoor tiling installation', qty: 1, unitPrice: 70.00, unit: 'sqm' },
      { description: 'Substrate preparation', qty: 1, unitPrice: 15.00, unit: 'sqm' }
    ]),
  createTemplate('invoice', 'tiling', 'tiling-standard-inv', 'Standard Tiling Invoice',
    '#ca8a04', 'Tiling Services Invoice', 'Invoice for tiling work',
    'Payment due within 14 days. Grout sealer recommended.',
    0, 14, [
      { description: 'Tiling work complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'tiling', 'tiling-bathroom-inv', 'Bathroom Tiling Invoice',
    '#ca8a04', 'Bathroom Tiling Invoice', 'Invoice for bathroom tiling',
    'Payment due within 14 days. Waterproofing certificate attached.',
    0, 14, [
      { description: 'Bathroom tiling complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'tiling', 'tiling-outdoor-inv', 'Outdoor Tiling Invoice',
    '#ca8a04', 'Outdoor Tiling Invoice', 'Invoice for outdoor tiling',
    'Payment due within 14 days. Maintenance tips attached.',
    0, 14, [
      { description: 'Outdoor tiling complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'tiling', 'tiling-standard-job', 'Standard Tiling Job',
    '#ca8a04', 'Tiling Work', 'Floor and wall tiling',
    'All materials and cleanup included.',
    0, 14, [
      { description: 'Tiling work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'tiling', 'tiling-bathroom-job', 'Bathroom Tiling Job',
    '#ca8a04', 'Bathroom Tiling', 'Complete bathroom tiling',
    'Waterproofing and grouting included.',
    0, 14, [
      { description: 'Bathroom tiling', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'tiling', 'tiling-outdoor-job', 'Outdoor Tiling Job',
    '#ca8a04', 'Outdoor Tiling', 'Patio and outdoor tiling',
    'Slip-resistant tiles used.',
    0, 14, [
      { description: 'Outdoor tiling', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // LANDSCAPING (3 quotes, 3 invoices, 3 jobs)
  // ============================================
  createTemplate('quote', 'landscaping', 'landscaping-standard', 'Standard Landscaping Quote',
    '#16a34a', 'Landscaping Services Quote', 'Professional garden and landscape services',
    'Quote valid for 30 days. All plants and materials included. Site cleanup included. GST included.',
    30, 30, [
      { description: 'Labour - Landscaping', qty: 1, unitPrice: 65.00, unit: 'hour' },
      { description: 'Materials and plants', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('quote', 'landscaping', 'landscaping-garden', 'Garden Design Quote',
    '#16a34a', 'Garden Design & Installation Quote', 'Complete garden design and installation',
    'Quote valid for 45 days. Design consultation included. All plants established natives. Mulching included. GST included.',
    30, 45, [
      { description: 'Garden design and plan', qty: 1, unitPrice: 450.00, unit: 'flat' },
      { description: 'Plant installation', qty: 1, unitPrice: 35.00, unit: 'each' },
      { description: 'Mulching', qty: 1, unitPrice: 8.00, unit: 'sqm' }
    ]),
  createTemplate('quote', 'landscaping', 'landscaping-retaining', 'Retaining Wall Quote',
    '#16a34a', 'Retaining Wall Quote', 'Timber or block retaining wall construction',
    'Quote valid for 30 days. Drainage included. Council approval assistance if required. GST included.',
    30, 30, [
      { description: 'Retaining wall (block)', qty: 1, unitPrice: 250.00, unit: 'lineal metre' },
      { description: 'Drainage installation', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('invoice', 'landscaping', 'landscaping-standard-inv', 'Standard Landscaping Invoice',
    '#16a34a', 'Landscaping Services Invoice', 'Invoice for landscaping work',
    'Payment due within 14 days. Plant care instructions provided.',
    0, 14, [
      { description: 'Landscaping work complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'landscaping', 'landscaping-garden-inv', 'Garden Design Invoice',
    '#16a34a', 'Garden Installation Invoice', 'Invoice for garden design and installation',
    'Payment due within 14 days. Watering schedule attached.',
    0, 14, [
      { description: 'Garden installation complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('invoice', 'landscaping', 'landscaping-retaining-inv', 'Retaining Wall Invoice',
    '#16a34a', 'Retaining Wall Invoice', 'Invoice for retaining wall construction',
    'Payment due within 14 days. Structural guarantee included.',
    0, 14, [
      { description: 'Retaining wall complete', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'landscaping', 'landscaping-standard-job', 'Standard Landscaping Job',
    '#16a34a', 'Landscaping Work', 'General landscaping services',
    'All cleanup and waste removal included.',
    0, 14, [
      { description: 'Landscaping work as discussed', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'landscaping', 'landscaping-garden-job', 'Garden Installation Job',
    '#16a34a', 'Garden Installation', 'Design and install new garden',
    'Native plants recommended.',
    0, 14, [
      { description: 'Garden installation', qty: 1, unitPrice: 0, unit: 'job' }
    ]),
  createTemplate('job', 'landscaping', 'landscaping-retaining-job', 'Retaining Wall Job',
    '#16a34a', 'Retaining Wall', 'Build retaining wall',
    'Proper drainage included.',
    0, 14, [
      { description: 'Retaining wall construction', qty: 1, unitPrice: 0, unit: 'job' }
    ]),

  // ============================================
  // GENERAL (3 quotes, 3 invoices, 3 jobs) - Fallback for all trades
  // ============================================
  createTemplate('quote', 'general', 'general-standard', 'Standard Quote',
    '#6366f1', 'Services Quote', 'Professional trade services',
    'Quote valid for 30 days. All materials and labour included. Work guaranteed. GST included.',
    30, 30, [
      { description: 'Labour', qty: 1, unitPrice: 75.00, unit: 'hour' },
      { description: 'Materials', qty: 1, unitPrice: 0, unit: 'lot' }
    ]),
  createTemplate('quote', 'general', 'general-project', 'Project Quote',
    '#6366f1', 'Project Quote', 'Complete project quotation',
    'Quote valid for 45 days. Progress payments apply for larger projects. Full scope included. GST included.',
    30, 45, [
      { description: 'Labour', qty: 8, unitPrice: 85.00, unit: 'hour' },
      { description: 'Materials and supplies', qty: 1, unitPrice: 350.00, unit: 'lot' }
    ]),
  createTemplate('quote', 'general', 'general-maintenance', 'Maintenance Quote',
    '#6366f1', 'Maintenance Quote', 'Regular maintenance services',
    'Quote valid for 30 days. All routine maintenance included. GST included.',
    0, 30, [
      { description: 'Service call', qty: 1, unitPrice: 95.00, unit: 'visit' },
      { description: 'Labour', qty: 1, unitPrice: 85.00, unit: 'hour' }
    ]),
  createTemplate('invoice', 'general', 'general-standard-inv', 'Standard Invoice',
    '#6366f1', 'Services Invoice', 'Invoice for services rendered',
    'Payment due within 14 days. All work guaranteed.',
    0, 14, [
      { description: 'Labour', qty: 2, unitPrice: 85.00, unit: 'hour' },
      { description: 'Materials', qty: 1, unitPrice: 50.00, unit: 'lot' }
    ]),
  createTemplate('invoice', 'general', 'general-project-inv', 'Project Invoice',
    '#6366f1', 'Project Invoice', 'Invoice for project work',
    'Payment due within 14 days. Final payment as per quote.',
    0, 14, [
      { description: 'Labour', qty: 8, unitPrice: 85.00, unit: 'hour' },
      { description: 'Materials and supplies', qty: 1, unitPrice: 350.00, unit: 'lot' }
    ]),
  createTemplate('invoice', 'general', 'general-maintenance-inv', 'Maintenance Invoice',
    '#6366f1', 'Maintenance Invoice', 'Invoice for maintenance services',
    'Payment due within 14 days.',
    0, 14, [
      { description: 'Service call', qty: 1, unitPrice: 95.00, unit: 'visit' },
      { description: 'Labour', qty: 1, unitPrice: 85.00, unit: 'hour' }
    ]),
  createTemplate('job', 'general', 'general-standard-job', 'Standard Job',
    '#6366f1', 'Service Work', 'General work',
    'All work completed to high standard.',
    0, 14, [
      { description: 'Labour', qty: 2, unitPrice: 85.00, unit: 'hour' },
      { description: 'Materials', qty: 1, unitPrice: 50.00, unit: 'lot' }
    ]),
  createTemplate('job', 'general', 'general-project-job', 'Project Job',
    '#6366f1', 'Project', 'Project work',
    'Complete project scope.',
    0, 14, [
      { description: 'Labour', qty: 4, unitPrice: 85.00, unit: 'hour' },
      { description: 'Materials and supplies', qty: 1, unitPrice: 150.00, unit: 'lot' }
    ]),
  createTemplate('job', 'general', 'general-maintenance-job', 'Maintenance Job',
    '#6366f1', 'Maintenance', 'Routine maintenance',
    'Regular maintenance service.',
    0, 14, [
      { description: 'Service call', qty: 1, unitPrice: 95.00, unit: 'visit' },
      { description: 'Labour', qty: 1, unitPrice: 85.00, unit: 'hour' }
    ]),
];

// Trade-specific line items for quick selection
export const tradieLineItems = [
  // Electrical
  { tradeType: 'electrical', name: 'Power point installation', description: 'Install new GPO power point', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Light fitting installation', description: 'Install standard light fitting', unit: 'each', unitPrice: 120.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Safety switch installation', description: 'Install RCD safety switch', unit: 'each', unitPrice: 220.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Smoke alarm installation', description: 'Install 10-year lithium smoke alarm', unit: 'each', unitPrice: 150.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Ceiling fan installation', description: 'Supply and install ceiling fan', unit: 'each', unitPrice: 280.00, defaultQty: 1 },
  
  // Plumbing
  { tradeType: 'plumbing', name: 'Tap replacement', description: 'Supply and install mixer tap', unit: 'each', unitPrice: 280.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Toilet repair', description: 'Repair toilet cistern and fittings', unit: 'each', unitPrice: 160.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Drain clearing', description: 'Clear blocked drain', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Hot water service', description: 'Service hot water system', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Leak repair', description: 'Locate and repair water leak', unit: 'each', unitPrice: 220.00, defaultQty: 1 },
  
  // Carpentry
  { tradeType: 'carpentry', name: 'Door hanging', description: 'Hang new door with hardware', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Deck construction', description: 'Construct timber deck', unit: 'sqm', unitPrice: 220.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Window installation', description: 'Install new window', unit: 'each', unitPrice: 450.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Pergola construction', description: 'Build timber pergola', unit: 'sqm', unitPrice: 220.00, defaultQty: 1 },
  
  // Painting
  { tradeType: 'painting', name: 'Interior painting', description: 'Paint interior walls (2 coats)', unit: 'sqm', unitPrice: 22.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Exterior painting', description: 'Paint exterior surfaces', unit: 'sqm', unitPrice: 28.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Ceiling painting', description: 'Paint ceiling (2 coats)', unit: 'sqm', unitPrice: 18.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Trim and doors', description: 'Paint trim and doors', unit: 'lineal metre', unitPrice: 25.00, defaultQty: 1 },
  
  // HVAC
  { tradeType: 'hvac', name: 'Split system service', description: 'Standard HVAC service', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Split system install', description: 'Install split system AC', unit: 'each', unitPrice: 2800.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Gas leak repair', description: 'Locate and repair refrigerant leak', unit: 'each', unitPrice: 380.00, defaultQty: 1 },
  
  // Roofing
  { tradeType: 'roofing', name: 'Roof repair', description: 'Repair damaged roof section', unit: 'each', unitPrice: 350.00, defaultQty: 1 },
  { tradeType: 'roofing', name: 'Gutter cleaning', description: 'Clean and flush gutters', unit: 'lineal metre', unitPrice: 8.00, defaultQty: 1 },
  { tradeType: 'roofing', name: 'Ridge capping', description: 'Replace ridge capping', unit: 'lineal metre', unitPrice: 45.00, defaultQty: 1 },
  
  // Tiling
  { tradeType: 'tiling', name: 'Floor tiling', description: 'Install floor tiles', unit: 'sqm', unitPrice: 65.00, defaultQty: 1 },
  { tradeType: 'tiling', name: 'Wall tiling', description: 'Install wall tiles', unit: 'sqm', unitPrice: 70.00, defaultQty: 1 },
  { tradeType: 'tiling', name: 'Waterproofing', description: 'Apply waterproof membrane', unit: 'sqm', unitPrice: 45.00, defaultQty: 1 },
  
  // Landscaping
  { tradeType: 'landscaping', name: 'Lawn mowing', description: 'Mow and edge lawns', unit: 'sqm', unitPrice: 0.50, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Mulching', description: 'Apply organic mulch', unit: 'sqm', unitPrice: 8.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Plant installation', description: 'Supply and plant', unit: 'each', unitPrice: 35.00, defaultQty: 1 },
  
  // General
  { tradeType: 'general', name: 'Labour', description: 'General labour', unit: 'hour', unitPrice: 75.00, defaultQty: 1 },
  { tradeType: 'general', name: 'Materials', description: 'Materials supplied', unit: 'lot', unitPrice: 0, defaultQty: 1 },
  { tradeType: 'general', name: 'Call-out fee', description: 'Service call-out', unit: 'flat', unitPrice: 80.00, defaultQty: 1 },
];

// Trade-specific rate cards
export const tradieRateCards = [
  { tradeType: 'electrical', name: 'Standard Rate', hourlyRate: 135, calloutFee: 90, afterHoursMultiplier: 1.5 },
  { tradeType: 'plumbing', name: 'Standard Rate', hourlyRate: 120, calloutFee: 80, afterHoursMultiplier: 1.5 },
  { tradeType: 'carpentry', name: 'Standard Rate', hourlyRate: 85, calloutFee: 60, afterHoursMultiplier: 1.3 },
  { tradeType: 'painting', name: 'Standard Rate', hourlyRate: 65, calloutFee: 0, afterHoursMultiplier: 1.3 },
  { tradeType: 'hvac', name: 'Standard Rate', hourlyRate: 95, calloutFee: 90, afterHoursMultiplier: 1.5 },
  { tradeType: 'roofing', name: 'Standard Rate', hourlyRate: 95, calloutFee: 80, afterHoursMultiplier: 1.4 },
  { tradeType: 'tiling', name: 'Standard Rate', hourlyRate: 75, calloutFee: 60, afterHoursMultiplier: 1.3 },
  { tradeType: 'landscaping', name: 'Standard Rate', hourlyRate: 65, calloutFee: 50, afterHoursMultiplier: 1.3 },
  { tradeType: 'general', name: 'Standard Rate', hourlyRate: 75, calloutFee: 65, afterHoursMultiplier: 1.4 },
];
