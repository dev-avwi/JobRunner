// Built-in Job Card templates, grouped by trade.
// A Job Card is an on-site checklist (a custom form with isJobCard=true) that the
// team fills in on every job. These templates give tradies verified, sensible
// starting points they can "Customise" — which creates a real, editable job card.
//
// Mirrors the SWMS_TEMPLATES pattern (server/routes.ts): a hardcoded array served
// read-only, with the create/customise step going through the normal
// POST /api/custom-forms route on the client.

export type JobCardFieldType =
  | 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'checkbox'
  | 'radio' | 'select' | 'date' | 'time' | 'photo' | 'signature' | 'section';

export interface JobCardTemplateField {
  id: string;
  type: JobCardFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
}

export interface JobCardTemplate {
  id: string;
  trade: string;        // trade key (matches shared/tradeCatalog.ts ids)
  tradeLabel: string;   // human-friendly trade name
  name: string;
  description: string;
  requiresSignature?: boolean;
  blockJobCompletion?: boolean;
  fields: JobCardTemplateField[];
}

// ---- small field helpers to keep templates readable ----
const section = (id: string, label: string): JobCardTemplateField => ({ id, type: 'section', label });
const check = (id: string, label: string, required = false): JobCardTemplateField => ({ id, type: 'checkbox', label, required });
const text = (id: string, label: string, opts: Partial<JobCardTemplateField> = {}): JobCardTemplateField => ({ id, type: 'text', label, ...opts });
const notes = (id: string, label: string, opts: Partial<JobCardTemplateField> = {}): JobCardTemplateField => ({ id, type: 'textarea', label, ...opts });
const num = (id: string, label: string, opts: Partial<JobCardTemplateField> = {}): JobCardTemplateField => ({ id, type: 'number', label, ...opts });
const select = (id: string, label: string, options: string[], opts: Partial<JobCardTemplateField> = {}): JobCardTemplateField => ({ id, type: 'select', label, options, ...opts });
const photo = (id: string, label: string, opts: Partial<JobCardTemplateField> = {}): JobCardTemplateField => ({ id, type: 'photo', label, ...opts });

// Common closing block reused by most templates: materials, photos, customer sign-off.
const closeout = (prefix: string): JobCardTemplateField[] => [
  section(`${prefix}-materials-sec`, 'Materials & time'),
  notes(`${prefix}-materials`, 'Materials used', { placeholder: 'List materials and quantities' }),
  num(`${prefix}-hours`, 'Hours on site'),
  section(`${prefix}-photos-sec`, 'Photos'),
  photo(`${prefix}-photo-before`, 'Before photo'),
  photo(`${prefix}-photo-after`, 'After photo'),
  section(`${prefix}-signoff-sec`, 'Sign-off'),
  check(`${prefix}-clean`, 'Site left clean and tidy'),
  check(`${prefix}-explained`, 'Work explained to customer'),
  text(`${prefix}-customer-name`, 'Customer name'),
  { id: `${prefix}-signature`, type: 'signature', label: 'Customer signature' },
];

export const JOB_CARD_TEMPLATES: JobCardTemplate[] = [
  // ===================== ELECTRICAL =====================
  {
    id: 'electrical-install', trade: 'electrical', tradeLabel: 'Electrical',
    name: 'Electrical Installation Job Card',
    description: 'Standard checklist for electrical install and fit-off work.',
    requiresSignature: true,
    fields: [
      section('ei-pre', 'Pre-start'),
      check('ei-isolated', 'Power isolated and tested dead', true),
      check('ei-loto', 'Lock-out / tag-out in place'),
      select('ei-worktype', 'Work type', ['New install', 'Fit-off', 'Fault find', 'Addition']),
      section('ei-work', 'Work performed'),
      notes('ei-desc', 'Description of work', { required: true }),
      check('ei-tested', 'Circuits tested (insulation, polarity, earth)', true),
      text('ei-coc', 'Certificate of Compliance / CES number'),
      ...closeout('ei'),
    ],
  },
  {
    id: 'electrical-switchboard', trade: 'electrical', tradeLabel: 'Electrical',
    name: 'Switchboard Upgrade Job Card',
    description: 'For switchboard replacements and safety switch upgrades.',
    requiresSignature: true,
    fields: [
      section('sw-pre', 'Pre-start'),
      check('sw-isolated', 'Supply isolated at main / metering authority notified', true),
      check('sw-photo-old', 'Photo of existing board taken'),
      section('sw-work', 'Work performed'),
      num('sw-rcd', 'Number of RCDs / safety switches fitted'),
      check('sw-labelled', 'All circuits labelled', true),
      check('sw-rcd-tested', 'RCDs tested and trip times recorded', true),
      notes('sw-notes', 'Notes'),
      text('sw-coc', 'Certificate of Compliance number'),
      ...closeout('sw'),
    ],
  },
  {
    id: 'electrical-inspection', trade: 'electrical', tradeLabel: 'Electrical',
    name: 'Electrical Safety Inspection Job Card',
    description: 'Periodic safety inspection and test-and-tag style check.',
    fields: [
      section('es-scope', 'Scope'),
      select('es-type', 'Inspection type', ['Safety inspection', 'Test and tag', 'Pre-sale', 'Insurance']),
      section('es-checks', 'Checks'),
      check('es-board', 'Switchboard checked (no damage/overheating)'),
      check('es-rcd', 'Safety switches present and working'),
      check('es-smoke', 'Smoke alarms tested'),
      check('es-gpo', 'Power points and switches checked'),
      notes('es-defects', 'Defects found', { placeholder: 'List any defects or recommendations' }),
      ...closeout('es'),
    ],
  },

  // ===================== PLUMBING =====================
  {
    id: 'plumbing-general', trade: 'plumbing', tradeLabel: 'Plumbing',
    name: 'General Plumbing Job Card',
    description: 'Everyday plumbing repairs and maintenance.',
    requiresSignature: true,
    fields: [
      section('pg-pre', 'Pre-start'),
      check('pg-water-off', 'Water isolated where required'),
      select('pg-worktype', 'Work type', ['Repair', 'Replacement', 'Maintenance', 'Install']),
      section('pg-work', 'Work performed'),
      notes('pg-desc', 'Description of work', { required: true }),
      check('pg-leak-test', 'Leak tested after work', true),
      check('pg-pressure', 'Water pressure checked'),
      ...closeout('pg'),
    ],
  },
  {
    id: 'plumbing-hot-water', trade: 'plumbing', tradeLabel: 'Plumbing',
    name: 'Hot Water System Job Card',
    description: 'Install or replace hot water units (electric, gas, heat pump).',
    requiresSignature: true,
    fields: [
      section('hw-pre', 'Pre-start'),
      check('hw-isolated', 'Power / gas and water isolated', true),
      select('hw-type', 'System type', ['Electric', 'Gas', 'Heat pump', 'Solar']),
      text('hw-capacity', 'Capacity (L)'),
      section('hw-work', 'Work performed'),
      check('hw-tpr', 'Temperature/pressure relief valve fitted & drain run', true),
      check('hw-tempered', 'Tempering valve fitted (50°C at outlets)', true),
      check('hw-tested', 'System tested for leaks and operation', true),
      notes('hw-notes', 'Notes'),
      ...closeout('hw'),
    ],
  },
  {
    id: 'plumbing-drain', trade: 'plumbing', tradeLabel: 'Plumbing',
    name: 'Blocked Drain / Leak Job Card',
    description: 'Drain clearing, leak detection and repair.',
    fields: [
      section('pd-scope', 'Scope'),
      select('pd-issue', 'Issue', ['Blocked drain', 'Leak', 'Overflow', 'Root intrusion']),
      text('pd-location', 'Location of issue'),
      section('pd-work', 'Work performed'),
      check('pd-cctv', 'CCTV drain camera used'),
      check('pd-cleared', 'Blockage cleared / leak repaired', true),
      check('pd-flow', 'Flow tested after work', true),
      notes('pd-cause', 'Likely cause and recommendation'),
      ...closeout('pd'),
    ],
  },

  // ===================== BUILDING =====================
  {
    id: 'building-general', trade: 'building', tradeLabel: 'Building & Construction',
    name: 'General Building Job Card',
    description: 'Carpentry and general building works.',
    requiresSignature: true,
    fields: [
      section('bg-pre', 'Pre-start'),
      check('bg-permit', 'Permits / approvals sighted where required'),
      text('bg-permit-no', 'Building permit number'),
      section('bg-work', 'Work performed'),
      notes('bg-desc', 'Description of work', { required: true }),
      check('bg-level', 'Work checked level / square / plumb'),
      ...closeout('bg'),
    ],
  },
  {
    id: 'building-prestart', trade: 'building', tradeLabel: 'Building & Construction',
    name: 'Site Pre-Start & Handover Job Card',
    description: 'Daily site set-up and end-of-day handover.',
    fields: [
      section('bp-start', 'Pre-start'),
      check('bp-swms', 'SWMS reviewed and signed by all workers', true),
      check('bp-ppe', 'PPE checked'),
      check('bp-access', 'Site access and exclusion zones set'),
      num('bp-workers', 'Workers on site'),
      section('bp-progress', 'Progress'),
      notes('bp-done', 'Work completed today'),
      notes('bp-next', 'Plan for next day'),
      section('bp-hand', 'Handover'),
      check('bp-secure', 'Site left secure'),
      photo('bp-photo', 'Site photo'),
    ],
  },
  {
    id: 'building-reno', trade: 'building', tradeLabel: 'Building & Construction',
    name: 'Renovation Job Card',
    description: 'Renovation and fit-out works with existing conditions record.',
    requiresSignature: true,
    fields: [
      section('br-existing', 'Existing conditions'),
      photo('br-photo-before', 'Photo of existing condition'),
      notes('br-existing-notes', 'Existing damage / notes'),
      section('br-work', 'Work performed'),
      notes('br-desc', 'Description of work', { required: true }),
      check('br-variations', 'Variations discussed and recorded'),
      ...closeout('br'),
    ],
  },

  // ===================== LANDSCAPING =====================
  {
    id: 'landscaping-general', trade: 'landscaping', tradeLabel: 'Landscaping & Gardening',
    name: 'Landscaping Job Card',
    description: 'General landscaping and garden works.',
    requiresSignature: true,
    fields: [
      section('lg-pre', 'Pre-start'),
      check('lg-dbyd', 'Dial Before You Dig checked (if excavating)'),
      select('lg-worktype', 'Work type', ['Planting', 'Turf', 'Paving', 'Mulching', 'Clearing']),
      section('lg-work', 'Work performed'),
      notes('lg-desc', 'Description of work', { required: true }),
      ...closeout('lg'),
    ],
  },
  {
    id: 'landscaping-design', trade: 'landscaping', tradeLabel: 'Landscaping & Gardening',
    name: 'Garden Design & Install Job Card',
    description: 'Design install with plant schedule and layout sign-off.',
    requiresSignature: true,
    fields: [
      section('ld-plan', 'Plan'),
      check('ld-layout', 'Layout marked out and approved by customer'),
      notes('ld-plants', 'Plant schedule', { placeholder: 'Species and quantities' }),
      section('ld-work', 'Work performed'),
      check('ld-soil', 'Soil prepared / conditioned'),
      check('ld-planted', 'Plants installed to plan'),
      ...closeout('ld'),
    ],
  },
  {
    id: 'landscaping-irrigation', trade: 'landscaping', tradeLabel: 'Landscaping & Gardening',
    name: 'Irrigation Install Job Card',
    description: 'Irrigation system install and commissioning.',
    fields: [
      section('li-work', 'Work performed'),
      num('li-zones', 'Number of zones'),
      check('li-backflow', 'Backflow prevention fitted', true),
      check('li-controller', 'Controller programmed'),
      check('li-tested', 'System tested, no leaks, even coverage', true),
      notes('li-schedule', 'Watering schedule set'),
      ...closeout('li'),
    ],
  },

  // ===================== PAINTING =====================
  {
    id: 'painting-interior', trade: 'painting', tradeLabel: 'Painting & Decorating',
    name: 'Interior Painting Job Card',
    description: 'Interior prep, paint and clean-up checklist.',
    requiresSignature: true,
    fields: [
      section('pi-pre', 'Prep'),
      check('pi-protect', 'Floors and furniture protected'),
      check('pi-prep', 'Surfaces sanded, filled and primed'),
      section('pi-work', 'Work performed'),
      text('pi-colour', 'Colour / product used'),
      num('pi-coats', 'Number of coats'),
      ...closeout('pi'),
    ],
  },
  {
    id: 'painting-exterior', trade: 'painting', tradeLabel: 'Painting & Decorating',
    name: 'Exterior Painting Job Card',
    description: 'Exterior painting including weather and prep checks.',
    requiresSignature: true,
    fields: [
      section('pe-pre', 'Prep'),
      check('pe-weather', 'Weather suitable for painting'),
      check('pe-wash', 'Surfaces washed / prepared'),
      check('pe-repairs', 'Repairs and priming completed'),
      section('pe-work', 'Work performed'),
      text('pe-colour', 'Colour / product used'),
      num('pe-coats', 'Number of coats'),
      ...closeout('pe'),
    ],
  },
  {
    id: 'painting-prep', trade: 'painting', tradeLabel: 'Painting & Decorating',
    name: 'Prep & Surface Repair Job Card',
    description: 'Surface repair and preparation before painting.',
    fields: [
      section('pp-work', 'Work performed'),
      check('pp-strip', 'Loose / flaking paint removed'),
      check('pp-fill', 'Cracks and holes filled'),
      check('pp-sand', 'Surfaces sanded smooth'),
      check('pp-prime', 'Primer / sealer applied'),
      notes('pp-notes', 'Notes'),
      ...closeout('pp'),
    ],
  },

  // ===================== HVAC =====================
  {
    id: 'hvac-install', trade: 'hvac', tradeLabel: 'Air Conditioning & HVAC',
    name: 'Air Conditioning Install Job Card',
    description: 'Split / ducted air conditioning installation.',
    requiresSignature: true,
    fields: [
      section('hi-pre', 'Pre-start'),
      select('hi-type', 'System type', ['Split', 'Multi-split', 'Ducted', 'Cassette']),
      text('hi-capacity', 'Capacity (kW)'),
      section('hi-work', 'Work performed'),
      check('hi-mount', 'Indoor and outdoor units mounted securely'),
      check('hi-vacuum', 'Lines evacuated / vacuum pulled', true),
      check('hi-leak', 'Leak test completed', true),
      check('hi-tested', 'Heating and cooling tested', true),
      ...closeout('hi'),
    ],
  },
  {
    id: 'hvac-service', trade: 'hvac', tradeLabel: 'Air Conditioning & HVAC',
    name: 'HVAC Service & Maintenance Job Card',
    description: 'Routine service and filter clean.',
    fields: [
      section('hs-checks', 'Service checks'),
      check('hs-filters', 'Filters cleaned / replaced'),
      check('hs-coils', 'Coils cleaned'),
      check('hs-drain', 'Drain cleared and tested'),
      check('hs-gas', 'Refrigerant pressures checked'),
      num('hs-temp', 'Supply air temperature (°C)'),
      notes('hs-notes', 'Notes / recommendations'),
      ...closeout('hs'),
    ],
  },
  {
    id: 'hvac-repair', trade: 'hvac', tradeLabel: 'Air Conditioning & HVAC',
    name: 'Heating / Cooling Repair Job Card',
    description: 'Fault diagnosis and repair.',
    fields: [
      section('hr-fault', 'Fault'),
      notes('hr-reported', 'Reported fault'),
      text('hr-code', 'Error code (if any)'),
      section('hr-work', 'Work performed'),
      notes('hr-diagnosis', 'Diagnosis'),
      notes('hr-repair', 'Repair carried out', { required: true }),
      check('hr-tested', 'Tested and operating correctly', true),
      ...closeout('hr'),
    ],
  },

  // ===================== ROOFING =====================
  {
    id: 'roofing-restoration', trade: 'roofing', tradeLabel: 'Roofing',
    name: 'Roof Restoration Job Card',
    description: 'Clean, repair and recoat roof.',
    requiresSignature: true,
    fields: [
      section('rr-pre', 'Pre-start'),
      check('rr-height', 'Height safety / harness in place', true),
      section('rr-work', 'Work performed'),
      check('rr-clean', 'Roof cleaned / pressure washed'),
      check('rr-repairs', 'Broken tiles / rusted sheets replaced'),
      check('rr-repoint', 'Ridge capping re-pointed'),
      num('rr-coats', 'Number of coats applied'),
      ...closeout('rr'),
    ],
  },
  {
    id: 'roofing-repair', trade: 'roofing', tradeLabel: 'Roofing',
    name: 'Roof Repair / Leak Job Card',
    description: 'Leak investigation and repair.',
    fields: [
      section('rp-scope', 'Scope'),
      text('rp-location', 'Leak location'),
      section('rp-work', 'Work performed'),
      check('rp-height', 'Height safety in place', true),
      notes('rp-cause', 'Cause of leak'),
      notes('rp-repair', 'Repair carried out', { required: true }),
      check('rp-tested', 'Water tested where possible'),
      ...closeout('rp'),
    ],
  },
  {
    id: 'roofing-gutter', trade: 'roofing', tradeLabel: 'Roofing',
    name: 'Gutter & Downpipe Job Card',
    description: 'Gutter clean, repair or replacement.',
    fields: [
      section('rg-work', 'Work performed'),
      select('rg-type', 'Work type', ['Clean', 'Repair', 'Replace', 'Gutter guard']),
      check('rg-height', 'Height safety in place', true),
      check('rg-flow', 'Downpipes flowing freely'),
      check('rg-fall', 'Correct fall to downpipes'),
      notes('rg-notes', 'Notes'),
      ...closeout('rg'),
    ],
  },

  // ===================== TILING =====================
  {
    id: 'tiling-general', trade: 'tiling', tradeLabel: 'Tiling',
    name: 'Tiling Job Card',
    description: 'Wall and floor tiling.',
    requiresSignature: true,
    fields: [
      section('tg-pre', 'Prep'),
      check('tg-substrate', 'Substrate sound, clean and level'),
      section('tg-work', 'Work performed'),
      text('tg-tile', 'Tile type / size'),
      num('tg-area', 'Area tiled (m²)'),
      check('tg-grout', 'Grouted and cleaned'),
      check('tg-silicone', 'Silicone to movement joints'),
      ...closeout('tg'),
    ],
  },
  {
    id: 'tiling-wetarea', trade: 'tiling', tradeLabel: 'Tiling',
    name: 'Waterproofing & Wet Area Job Card',
    description: 'Wet area waterproofing to AS 3740 before tiling.',
    requiresSignature: true,
    fields: [
      section('tw-water', 'Waterproofing'),
      check('tw-primer', 'Primer applied'),
      check('tw-bond', 'Bond breaker to junctions', true),
      num('tw-coats', 'Membrane coats applied'),
      check('tw-flood', 'Flood test passed', true),
      photo('tw-photo-membrane', 'Photo of completed membrane'),
      section('tw-work', 'Tiling'),
      num('tw-area', 'Area tiled (m²)'),
      check('tw-falls', 'Falls to floor waste correct'),
      ...closeout('tw'),
    ],
  },
  {
    id: 'tiling-floorprep', trade: 'tiling', tradeLabel: 'Tiling',
    name: 'Floor Prep & Levelling Job Card',
    description: 'Screed and level floors before tiling.',
    fields: [
      section('tf-work', 'Work performed'),
      check('tf-clean', 'Floor cleaned and primed'),
      check('tf-level', 'Self-levelling / screed applied'),
      num('tf-area', 'Area prepared (m²)'),
      check('tf-cure', 'Left to cure per product spec'),
      notes('tf-notes', 'Notes'),
      ...closeout('tf'),
    ],
  },

  // ===================== CONCRETING =====================
  {
    id: 'concreting-pour', trade: 'concreting', tradeLabel: 'Concreting',
    name: 'Concrete Pour Job Card',
    description: 'Slab / footing pour with mix and finish record.',
    requiresSignature: true,
    fields: [
      section('cp-pre', 'Pre-pour'),
      check('cp-form', 'Formwork checked and braced'),
      check('cp-steel', 'Reinforcement placed and chaired'),
      text('cp-mix', 'Concrete mix (MPa / slump)'),
      num('cp-volume', 'Volume poured (m³)'),
      section('cp-work', 'Pour & finish'),
      select('cp-finish', 'Finish', ['Trowel', 'Broom', 'Exposed aggregate', 'Float']),
      check('cp-cured', 'Curing method applied'),
      ...closeout('cp'),
    ],
  },
  {
    id: 'concreting-driveway', trade: 'concreting', tradeLabel: 'Concreting',
    name: 'Driveway / Path Job Card',
    description: 'Driveway, path and slab flatwork.',
    requiresSignature: true,
    fields: [
      section('cd-pre', 'Pre-pour'),
      check('cd-base', 'Base compacted to level'),
      check('cd-joints', 'Expansion / control joints planned'),
      section('cd-work', 'Work performed'),
      num('cd-area', 'Area poured (m²)'),
      select('cd-finish', 'Finish', ['Broom', 'Exposed aggregate', 'Coloured', 'Plain']),
      ...closeout('cd'),
    ],
  },
  {
    id: 'concreting-formwork', trade: 'concreting', tradeLabel: 'Concreting',
    name: 'Slab Prep & Formwork Job Card',
    description: 'Set-out, formwork and reinforcement before pour.',
    fields: [
      section('cf-work', 'Work performed'),
      check('cf-setout', 'Set-out checked against plan'),
      check('cf-form', 'Formwork level and braced'),
      check('cf-membrane', 'Vapour barrier / membrane laid'),
      check('cf-steel', 'Reinforcement placed to spec'),
      check('cf-inspection', 'Ready for inspection / pour'),
      notes('cf-notes', 'Notes'),
      photo('cf-photo', 'Photo before pour'),
    ],
  },

  // ===================== FENCING =====================
  {
    id: 'fencing-install', trade: 'fencing', tradeLabel: 'Fencing',
    name: 'Fence Install Job Card',
    description: 'New fence installation.',
    requiresSignature: true,
    fields: [
      section('fi-pre', 'Pre-start'),
      check('fi-dbyd', 'Dial Before You Dig checked'),
      check('fi-boundary', 'Boundary / line confirmed with customer'),
      select('fi-type', 'Fence type', ['Colorbond', 'Timber', 'Aluminium', 'Chain wire', 'Glass']),
      section('fi-work', 'Work performed'),
      num('fi-length', 'Length (m)'),
      check('fi-posts', 'Posts concreted and level'),
      ...closeout('fi'),
    ],
  },
  {
    id: 'fencing-gate', trade: 'fencing', tradeLabel: 'Fencing',
    name: 'Gate Install / Repair Job Card',
    description: 'Gate hanging, hardware and automation.',
    fields: [
      section('fga-work', 'Work performed'),
      select('fga-type', 'Gate type', ['Swing', 'Sliding', 'Pedestrian', 'Automated']),
      check('fga-hung', 'Gate hung and swinging / sliding freely'),
      check('fga-latch', 'Latch / lock fitted and working'),
      check('fga-auto', 'Automation tested (if fitted)'),
      notes('fga-notes', 'Notes'),
      ...closeout('fga'),
    ],
  },
  {
    id: 'fencing-retaining', trade: 'fencing', tradeLabel: 'Fencing',
    name: 'Retaining Wall Job Card',
    description: 'Retaining wall build with drainage record.',
    requiresSignature: true,
    fields: [
      section('fr-pre', 'Pre-start'),
      check('fr-dbyd', 'Dial Before You Dig checked'),
      text('fr-height', 'Wall height (m)'),
      section('fr-work', 'Work performed'),
      check('fr-footing', 'Footing / base prepared'),
      check('fr-drainage', 'Ag drain and drainage aggregate installed', true),
      check('fr-backfill', 'Backfilled and compacted'),
      ...closeout('fr'),
    ],
  },

  // ===================== CLEANING =====================
  {
    id: 'cleaning-general', trade: 'cleaning', tradeLabel: 'Cleaning Services',
    name: 'Cleaning Job Card',
    description: 'General domestic / commercial clean checklist.',
    fields: [
      section('clg-scope', 'Scope'),
      select('clg-type', 'Clean type', ['Regular', 'Deep clean', 'One-off', 'Commercial']),
      section('clg-tasks', 'Tasks'),
      check('clg-kitchen', 'Kitchen cleaned'),
      check('clg-bath', 'Bathrooms cleaned'),
      check('clg-floors', 'Floors vacuumed / mopped'),
      check('clg-dust', 'Dusting and surfaces wiped'),
      notes('clg-notes', 'Notes / extra requests'),
      ...closeout('clg'),
    ],
  },
  {
    id: 'cleaning-endoflease', trade: 'cleaning', tradeLabel: 'Cleaning Services',
    name: 'End of Lease Cleaning Job Card',
    description: 'Bond / vacate clean checklist.',
    requiresSignature: true,
    fields: [
      section('cle-tasks', 'Tasks'),
      check('cle-oven', 'Oven and stovetop cleaned'),
      check('cle-bath', 'Bathrooms and tiles cleaned'),
      check('cle-windows', 'Windows and tracks cleaned'),
      check('cle-carpet', 'Carpets cleaned / steamed'),
      check('cle-walls', 'Marks removed from walls'),
      check('cle-final', 'Final inspection walk-through done'),
      ...closeout('cle'),
    ],
  },
  {
    id: 'cleaning-pressure', trade: 'cleaning', tradeLabel: 'Cleaning Services',
    name: 'Pressure Washing Job Card',
    description: 'External pressure washing of hard surfaces.',
    fields: [
      section('clp-work', 'Work performed'),
      notes('clp-areas', 'Areas cleaned', { placeholder: 'Driveway, paths, walls, etc.' }),
      check('clp-protect', 'Plants / surrounds protected'),
      check('clp-treated', 'Mould / stain treatment applied'),
      ...closeout('clp'),
    ],
  },

  // ===================== HANDYMAN =====================
  {
    id: 'handyman-general', trade: 'handyman', tradeLabel: 'Handyman Services',
    name: 'General Handyman Job Card',
    description: 'Multi-task handyman visit.',
    requiresSignature: true,
    fields: [
      section('hg-tasks', 'Tasks'),
      notes('hg-list', 'Tasks requested', { required: true, placeholder: 'List each task' }),
      section('hg-work', 'Work performed'),
      notes('hg-done', 'Work completed'),
      notes('hg-outstanding', 'Anything outstanding / follow-up'),
      ...closeout('hg'),
    ],
  },
  {
    id: 'handyman-assembly', trade: 'handyman', tradeLabel: 'Handyman Services',
    name: 'Assembly & Installation Job Card',
    description: 'Flat-pack assembly and fixture installation.',
    fields: [
      section('ha-work', 'Work performed'),
      notes('ha-items', 'Items assembled / installed', { required: true }),
      check('ha-secured', 'Fixed / anchored to wall where needed'),
      check('ha-tested', 'Tested and operating'),
      check('ha-rubbish', 'Packaging removed'),
      ...closeout('ha'),
    ],
  },
  {
    id: 'handyman-repairs', trade: 'handyman', tradeLabel: 'Handyman Services',
    name: 'Repairs & Maintenance Job Card',
    description: 'Small repairs and property maintenance.',
    fields: [
      section('hrm-scope', 'Scope'),
      notes('hrm-reported', 'Issue reported'),
      section('hrm-work', 'Work performed'),
      notes('hrm-repair', 'Repair carried out', { required: true }),
      check('hrm-tested', 'Tested and working'),
      ...closeout('hrm'),
    ],
  },

  // ===================== GENERAL =====================
  {
    id: 'general-standard', trade: 'general', tradeLabel: 'General Trade Services',
    name: 'Standard Job Card',
    description: 'A simple job card that suits any trade.',
    requiresSignature: true,
    fields: [
      section('gs-pre', 'Pre-start'),
      check('gs-safety', 'Site safety checked'),
      section('gs-work', 'Work performed'),
      notes('gs-desc', 'Description of work', { required: true }),
      ...closeout('gs'),
    ],
  },
  {
    id: 'general-attendance', trade: 'general', tradeLabel: 'General Trade Services',
    name: 'Site Attendance & Sign-off Job Card',
    description: 'Record attendance, time on site and customer sign-off.',
    fields: [
      section('ga-attend', 'Attendance'),
      { id: 'ga-arrive', type: 'time', label: 'Time arrived' },
      { id: 'ga-leave', type: 'time', label: 'Time left' },
      num('ga-workers', 'Workers on site'),
      section('ga-work', 'Work'),
      notes('ga-summary', 'Summary of work'),
      section('ga-signoff', 'Sign-off'),
      text('ga-customer', 'Customer name'),
      { id: 'ga-signature', type: 'signature', label: 'Customer signature' },
    ],
  },
  {
    id: 'general-assessment', trade: 'general', tradeLabel: 'General Trade Services',
    name: 'Quote & Assessment Job Card',
    description: 'On-site assessment before quoting.',
    fields: [
      section('gq-assess', 'Assessment'),
      notes('gq-scope', 'Scope of work discussed', { required: true }),
      notes('gq-access', 'Access / site conditions'),
      notes('gq-materials', 'Materials likely required'),
      num('gq-hours', 'Estimated hours'),
      photo('gq-photo', 'Site photo'),
      notes('gq-notes', 'Notes for quote'),
    ],
  },

  // ===================== GROUNDS MAINTENANCE =====================
  {
    id: 'grounds-general', trade: 'grounds_maintenance', tradeLabel: 'Grounds & Vegetation Management',
    name: 'Grounds Maintenance Job Card',
    description: 'Routine grounds and vegetation works.',
    fields: [
      section('grg-scope', 'Scope'),
      select('grg-service', 'Service type', ['Mowing', 'Vegetation clearing', 'Weed control', 'Tree work', 'General maintenance']),
      section('grg-work', 'Work performed'),
      notes('grg-desc', 'Description of work', { required: true }),
      check('grg-hazards', 'Site hazards checked (slopes, traffic, public)'),
      ...closeout('grg'),
    ],
  },
  {
    id: 'grounds-lawn', trade: 'grounds_maintenance', tradeLabel: 'Grounds & Vegetation Management',
    name: 'Lawn & Turf Care Job Card',
    description: 'Mowing, edging and turf treatment.',
    fields: [
      section('grl-work', 'Work performed'),
      check('grl-mow', 'Lawns mowed'),
      check('grl-edge', 'Edges trimmed'),
      check('grl-blow', 'Paths blown / cleared'),
      check('grl-treat', 'Fertiliser / weed treatment applied'),
      notes('grl-notes', 'Notes'),
      ...closeout('grl'),
    ],
  },
  {
    id: 'grounds-greenwaste', trade: 'grounds_maintenance', tradeLabel: 'Grounds & Vegetation Management',
    name: 'Green Waste & Site Tidy Job Card',
    description: 'Green waste removal and site clean-up.',
    fields: [
      section('grw-work', 'Work performed'),
      num('grw-loads', 'Loads removed'),
      check('grw-cleared', 'Green waste removed from site'),
      check('grw-tidy', 'Site raked and left tidy'),
      notes('grw-notes', 'Notes'),
      photo('grw-photo-after', 'After photo'),
    ],
  },
];

export function getJobCardTemplates(tradeType?: string): JobCardTemplate[] {
  if (!tradeType) return JOB_CARD_TEMPLATES;
  return JOB_CARD_TEMPLATES.filter(t => t.trade === tradeType || t.trade === 'general');
}
