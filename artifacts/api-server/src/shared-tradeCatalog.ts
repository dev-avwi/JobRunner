/**
 * Centralized Trade Catalog for JobRunner
 * Each trade has comprehensive configuration for a tailored app experience
 */

export interface TradeTerminology {
  job: string;
  jobs: string;
  client: string;
  clients: string;
  quote: string;
  quotes: string;
  worksite: string;
  worksites: string;
}

export interface TradeJobStage {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface TradeCustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  unit?: string;
}

export interface TradeMaterial {
  name: string;
  unit: string;
  defaultPrice: number;
  category: string;
}

export interface TradeRateCard {
  hourlyRate: number;
  calloutFee: number;
  afterHoursMultiplier: number;
  weekendMultiplier: number;
  materialMarkupPct: number;
}

export interface TradeSafetyChecklist {
  name: string;
  items: string[];
}

export interface JobScopeItem {
  id: string;
  label: string;
  category: 'labour' | 'materials' | 'compliance' | 'safety' | 'disposal';
  description?: string;
  defaultQty?: number;
  unit?: string;
  estimatedPrice?: number;
  required?: boolean;
  tags?: string[];
}

export interface JobScopeTemplate {
  id: string;
  tradeId: string;
  jobType: string;
  description: string;
  icon?: string;
  estimatedDuration?: string;
  items: JobScopeItem[];
  commonlyMissed?: string[];
}

export interface TradeDefinition {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  description: string;
  typicalJobs: string[];
  terminology: TradeTerminology;
  jobStages: TradeJobStage[];
  customFields: TradeCustomField[];
  defaultMaterials: TradeMaterial[];
  defaultRateCard: TradeRateCard;
  safetyChecklists: TradeSafetyChecklist[];
  quoteCategories: string[];
  invoicePaymentTerms: number;
  licenseRequired?: string;
}

const defaultTerminology: TradeTerminology = {
  job: 'Job',
  jobs: 'Jobs',
  client: 'Client',
  clients: 'Clients',
  quote: 'Quote',
  quotes: 'Quotes',
  worksite: 'Site',
  worksites: 'Sites',
};

const defaultJobStages: TradeJobStage[] = [
  { id: 'pending', name: 'Pending', description: 'Awaiting confirmation', color: '#6b7280' },
  { id: 'scheduled', name: 'Scheduled', description: 'Booked in calendar', color: '#3b82f6' },
  { id: 'in_progress', name: 'In Progress', description: 'Work underway', color: '#f59e0b' },
  { id: 'done', name: 'Done', description: 'Work completed', color: '#22c55e' },
  { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
];

export const tradeCatalog: Record<string, TradeDefinition> = {
  electrical: {
    id: 'electrical',
    name: 'Electrical',
    shortName: 'Sparky',
    icon: 'Zap',
    color: '#dc2626',
    description: 'Wiring, lighting, and electrical systems',
    typicalJobs: ['Power points', 'Light installation', 'Switchboard upgrades', 'Safety switches', 'Ceiling fans', 'Smoke alarms'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'circuitType', name: 'Circuit Type', type: 'select', options: ['Single Phase', 'Three Phase', 'Low Voltage'] },
      { id: 'amperage', name: 'Amperage', type: 'number', unit: 'A' },
      { id: 'rcdTested', name: 'RCD Tested', type: 'checkbox' },
      { id: 'cocRequired', name: 'Certificate of Compliance Required', type: 'checkbox' },
      { id: 'meterNumber', name: 'Meter Number', type: 'text' },
    ],
    defaultMaterials: [
      { name: 'Power Point (Double GPO)', unit: 'each', defaultPrice: 35, category: 'Outlets' },
      { name: 'LED Downlight', unit: 'each', defaultPrice: 45, category: 'Lighting' },
      { name: 'Safety Switch (RCD)', unit: 'each', defaultPrice: 85, category: 'Switchboard' },
      { name: 'Smoke Alarm (240V)', unit: 'each', defaultPrice: 65, category: 'Safety' },
      { name: 'Ceiling Fan', unit: 'each', defaultPrice: 180, category: 'Appliances' },
      { name: 'Cable (2.5mm TPS)', unit: 'm', defaultPrice: 4.50, category: 'Cable' },
      { name: 'Cable (4mm TPS)', unit: 'm', defaultPrice: 6.50, category: 'Cable' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 85,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Electrical Safety Checklist',
        items: [
          'Isolate power at switchboard',
          'Test for dead with voltage tester',
          'Lock out/tag out procedures followed',
          'PPE worn (insulated gloves, safety glasses)',
          'Fire extinguisher accessible',
          'Work area clear of hazards',
        ],
      },
    ],
    quoteCategories: ['Outlets & Switches', 'Lighting', 'Switchboard', 'Safety Devices', 'Appliance Installation', 'Rewiring'],
    invoicePaymentTerms: 14,
    licenseRequired: 'Electrical Contractor License',
  },

  plumbing: {
    id: 'plumbing',
    name: 'Plumbing',
    shortName: 'Plumber',
    icon: 'Droplets',
    color: '#2563eb',
    description: 'Pipes, taps, drains, and water systems',
    typicalJobs: ['Leak repairs', 'Tap installation', 'Drain clearing', 'Hot water systems', 'Toilet repairs', 'Gas fitting'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'pipeSize', name: 'Pipe Size', type: 'select', options: ['15mm', '20mm', '25mm', '32mm', '40mm', '50mm', '65mm', '80mm', '100mm'] },
      { id: 'pipeMaterial', name: 'Pipe Material', type: 'select', options: ['Copper', 'PVC', 'PEX', 'Galvanised', 'HDPE', 'Cast Iron'] },
      { id: 'waterPressure', name: 'Water Pressure', type: 'number', unit: 'kPa' },
      { id: 'hotWaterType', name: 'Hot Water Type', type: 'select', options: ['Electric', 'Gas', 'Solar', 'Heat Pump'] },
      { id: 'gasWork', name: 'Gas Work Involved', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Mixer Tap (Basin)', unit: 'each', defaultPrice: 120, category: 'Tapware' },
      { name: 'Mixer Tap (Kitchen)', unit: 'each', defaultPrice: 180, category: 'Tapware' },
      { name: 'Toilet Suite', unit: 'each', defaultPrice: 350, category: 'Fixtures' },
      { name: 'Basin', unit: 'each', defaultPrice: 150, category: 'Fixtures' },
      { name: 'Copper Pipe 15mm', unit: 'm', defaultPrice: 18, category: 'Pipes' },
      { name: 'PVC Pipe 50mm', unit: 'm', defaultPrice: 12, category: 'Pipes' },
      { name: 'Flexi Hose', unit: 'each', defaultPrice: 25, category: 'Fittings' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 90,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Plumbing Safety Checklist',
        items: [
          'Water supply isolated',
          'Gas supply isolated (if applicable)',
          'Hot water system isolated',
          'PPE worn (gloves, safety glasses)',
          'Drain camera inspection completed',
          'Asbestos check for older properties',
        ],
      },
    ],
    quoteCategories: ['Tapware', 'Fixtures', 'Pipes & Fittings', 'Hot Water', 'Drainage', 'Gas Fitting'],
    invoicePaymentTerms: 14,
    licenseRequired: 'Plumbing License',
  },

  building: {
    id: 'building',
    name: 'Building & Construction',
    shortName: 'Builder',
    icon: 'Hammer',
    color: '#ea580c',
    description: 'Construction, renovations, and building work',
    typicalJobs: ['Renovations', 'Extensions', 'Decks', 'Pergolas', 'Granny flats', 'Kitchen fit-outs'],
    terminology: {
      job: 'Project',
      jobs: 'Projects',
      client: 'Client',
      clients: 'Clients',
      quote: 'Estimate',
      quotes: 'Estimates',
      worksite: 'Site',
      worksites: 'Sites',
    },
    jobStages: [
      { id: 'pending', name: 'Quote Stage', description: 'Preparing estimate', color: '#6b7280' },
      { id: 'scheduled', name: 'Approved', description: 'Project approved', color: '#3b82f6' },
      { id: 'in_progress', name: 'Construction', description: 'Building underway', color: '#f59e0b' },
      { id: 'done', name: 'Practical Completion', description: 'Handover ready', color: '#22c55e' },
      { id: 'invoiced', name: 'Final Invoice', description: 'Final payment', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'projectType', name: 'Project Type', type: 'select', options: ['New Build', 'Renovation', 'Extension', 'Fit-out', 'Maintenance'] },
      { id: 'approvalRequired', name: 'Council Approval Required', type: 'checkbox' },
      { id: 'permitNumber', name: 'Building Permit Number', type: 'text' },
      { id: 'contractValue', name: 'Contract Value', type: 'number', unit: '$' },
      { id: 'retentionPct', name: 'Retention %', type: 'number', unit: '%' },
    ],
    defaultMaterials: [
      { name: 'Timber Framing (90x45)', unit: 'm', defaultPrice: 8.50, category: 'Timber' },
      { name: 'Timber Framing (140x45)', unit: 'm', defaultPrice: 12.50, category: 'Timber' },
      { name: 'Merbau Decking', unit: 'm²', defaultPrice: 85, category: 'Decking' },
      { name: 'Treated Pine Decking', unit: 'm²', defaultPrice: 45, category: 'Decking' },
      { name: 'Concrete (25MPa)', unit: 'm³', defaultPrice: 250, category: 'Concrete' },
      { name: 'Roofing (Colorbond)', unit: 'm²', defaultPrice: 35, category: 'Roofing' },
    ],
    defaultRateCard: {
      hourlyRate: 85,
      calloutFee: 0,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Construction Site Safety',
        items: [
          'Site induction completed',
          'SWMS reviewed and signed',
          'Hard hat and hi-vis worn',
          'Fall protection in place (if working at heights)',
          'First aid kit accessible',
          'Emergency exits clear',
          'Power tools inspected and tagged',
        ],
      },
    ],
    quoteCategories: ['Demolition', 'Framing', 'Roofing', 'Cladding', 'Fit-out', 'Finishing'],
    invoicePaymentTerms: 30,
    licenseRequired: 'Builder License (QBCC)',
  },

  landscaping: {
    id: 'landscaping',
    name: 'Landscaping & Gardening',
    shortName: 'Landscaper',
    icon: 'Trees',
    color: '#16a34a',
    description: 'Garden design, maintenance, and outdoor spaces',
    typicalJobs: ['Lawn installation', 'Garden beds', 'Tree removal', 'Irrigation', 'Retaining walls', 'Paving'],
    terminology: {
      job: 'Project',
      jobs: 'Projects',
      client: 'Client',
      clients: 'Clients',
      quote: 'Quote',
      quotes: 'Quotes',
      worksite: 'Property',
      worksites: 'Properties',
    },
    jobStages: [
      { id: 'pending', name: 'Design Phase', description: 'Planning and design', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Booked in', color: '#3b82f6' },
      { id: 'in_progress', name: 'Installation', description: 'Work in progress', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Planting/installation done', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'propertySize', name: 'Property Size', type: 'number', unit: 'm²' },
      { id: 'soilType', name: 'Soil Type', type: 'select', options: ['Clay', 'Sandy', 'Loam', 'Rocky', 'Mixed'] },
      { id: 'irrigationType', name: 'Irrigation Type', type: 'select', options: ['None', 'Manual', 'Drip', 'Sprinkler', 'Smart System'] },
      { id: 'greenWasteDisposal', name: 'Green Waste Disposal Required', type: 'checkbox' },
      { id: 'accessType', name: 'Site Access', type: 'select', options: ['Easy (vehicle)', 'Limited', 'Difficult (manual only)'] },
    ],
    defaultMaterials: [
      { name: 'Turf (Sir Walter)', unit: 'm²', defaultPrice: 16, category: 'Lawn' },
      { name: 'Turf (Couch)', unit: 'm²', defaultPrice: 12, category: 'Lawn' },
      { name: 'Mulch (Hardwood)', unit: 'm³', defaultPrice: 85, category: 'Mulch' },
      { name: 'Garden Soil', unit: 'm³', defaultPrice: 95, category: 'Soil' },
      { name: 'Sleepers (Treated Pine)', unit: 'each', defaultPrice: 35, category: 'Edging' },
      { name: 'Pavers', unit: 'm²', defaultPrice: 55, category: 'Paving' },
      { name: 'Dripper Line', unit: 'm', defaultPrice: 3.50, category: 'Irrigation' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Landscaping Safety Checklist',
        items: [
          'Underground services located (Dial Before You Dig)',
          'PPE worn (gloves, safety glasses, sun protection)',
          'Chainsaw safety gear (if tree work)',
          'First aid kit accessible',
          'Adequate hydration available',
          'Manual handling techniques followed',
        ],
      },
    ],
    quoteCategories: ['Lawn & Turf', 'Garden Beds', 'Tree Work', 'Irrigation', 'Hardscaping', 'Maintenance'],
    invoicePaymentTerms: 14,
  },

  painting: {
    id: 'painting',
    name: 'Painting & Decorating',
    shortName: 'Painter',
    icon: 'Paintbrush',
    color: '#7c3aed',
    description: 'Interior and exterior painting services',
    typicalJobs: ['House painting', 'Fence painting', 'Prep work', 'Wallpaper', 'Feature walls', 'Commercial painting'],
    terminology: { ...defaultTerminology },
    jobStages: [
      { id: 'pending', name: 'Quote Stage', description: 'Colour consult & quote', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Booked in', color: '#3b82f6' },
      { id: 'in_progress', name: 'Painting', description: 'Work in progress', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Final touch-ups done', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'surfaceType', name: 'Surface Type', type: 'select', options: ['Plaster', 'Brick', 'Timber', 'Metal', 'Render', 'Weatherboard'] },
      { id: 'paintType', name: 'Paint Type', type: 'select', options: ['Water-based', 'Oil-based', 'Epoxy', 'Enamel'] },
      { id: 'finishType', name: 'Finish', type: 'select', options: ['Flat', 'Low Sheen', 'Satin', 'Semi-Gloss', 'Gloss'] },
      { id: 'coatsRequired', name: 'Number of Coats', type: 'number' },
      { id: 'colourCode', name: 'Colour Code', type: 'text', placeholder: 'e.g., Dulux Vivid White' },
    ],
    defaultMaterials: [
      { name: 'Interior Paint (Premium)', unit: 'L', defaultPrice: 85, category: 'Paint' },
      { name: 'Exterior Paint (Premium)', unit: 'L', defaultPrice: 95, category: 'Paint' },
      { name: 'Primer/Sealer', unit: 'L', defaultPrice: 55, category: 'Primers' },
      { name: 'Filler (Interior)', unit: 'kg', defaultPrice: 25, category: 'Prep' },
      { name: 'Sandpaper (Pack)', unit: 'pack', defaultPrice: 18, category: 'Prep' },
      { name: 'Drop Sheet', unit: 'each', defaultPrice: 35, category: 'Protection' },
    ],
    defaultRateCard: {
      hourlyRate: 70,
      calloutFee: 0,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Painting Safety Checklist',
        items: [
          'Area well ventilated',
          'Drop sheets in place',
          'Ladder secured and inspected',
          'PPE worn (mask, safety glasses)',
          'Lead paint test (older properties)',
          'No naked flames near solvents',
        ],
      },
    ],
    quoteCategories: ['Interior Walls', 'Exterior Walls', 'Ceilings', 'Doors & Trim', 'Prep Work', 'Special Finishes'],
    invoicePaymentTerms: 14,
  },

  hvac: {
    id: 'hvac',
    name: 'Air Conditioning & HVAC',
    shortName: 'HVAC Tech',
    icon: 'Wind',
    color: '#0ea5e9',
    description: 'Climate control and ventilation systems',
    typicalJobs: ['AC installation', 'System servicing', 'Duct cleaning', 'Repairs', 'Commercial HVAC', 'Refrigeration'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'systemType', name: 'System Type', type: 'select', options: ['Split System', 'Ducted', 'Cassette', 'Multi-head', 'VRV/VRF', 'Window Unit'] },
      { id: 'capacity', name: 'Capacity', type: 'number', unit: 'kW' },
      { id: 'refrigerantType', name: 'Refrigerant Type', type: 'select', options: ['R32', 'R410A', 'R22 (Legacy)', 'R134a'] },
      { id: 'arcLicenseRequired', name: 'ARC License Work', type: 'checkbox' },
      { id: 'filterSize', name: 'Filter Size', type: 'text' },
    ],
    defaultMaterials: [
      { name: 'Split System 2.5kW', unit: 'each', defaultPrice: 1200, category: 'Units' },
      { name: 'Split System 5kW', unit: 'each', defaultPrice: 1800, category: 'Units' },
      { name: 'Split System 7kW', unit: 'each', defaultPrice: 2400, category: 'Units' },
      { name: 'Refrigerant R32', unit: 'kg', defaultPrice: 85, category: 'Refrigerant' },
      { name: 'Copper Pipe (6.35mm)', unit: 'm', defaultPrice: 18, category: 'Piping' },
      { name: 'Filter (Standard)', unit: 'each', defaultPrice: 35, category: 'Filters' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 95,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'HVAC Safety Checklist',
        items: [
          'Power isolated',
          'Refrigerant recovery equipment ready',
          'ARC license current',
          'PPE worn (gloves, safety glasses)',
          'Ladder secured',
          'Electrical testing completed',
        ],
      },
    ],
    quoteCategories: ['Supply & Install', 'Service & Maintenance', 'Repairs', 'Duct Work', 'Refrigeration'],
    invoicePaymentTerms: 14,
    licenseRequired: 'ARC License + Electrical License',
  },

  roofing: {
    id: 'roofing',
    name: 'Roofing',
    shortName: 'Roofer',
    icon: 'Home',
    color: '#78350f',
    description: 'Roof installation, repairs and restoration',
    typicalJobs: ['Roof repairs', 'Gutter installation', 'Tile replacement', 'Roof restoration', 'Whirlybirds', 'Skylights'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'roofType', name: 'Roof Type', type: 'select', options: ['Tile (Concrete)', 'Tile (Terracotta)', 'Colorbond', 'Zincalume', 'Asbestos (Legacy)'] },
      { id: 'roofPitch', name: 'Roof Pitch', type: 'select', options: ['Low (<15°)', 'Medium (15-25°)', 'Steep (>25°)'] },
      { id: 'roofArea', name: 'Roof Area', type: 'number', unit: 'm²' },
      { id: 'gutterLength', name: 'Gutter Length', type: 'number', unit: 'm' },
      { id: 'asbestosCheck', name: 'Asbestos Check Required', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Roof Tile (Concrete)', unit: 'each', defaultPrice: 4.50, category: 'Tiles' },
      { name: 'Colorbond Roofing', unit: 'm²', defaultPrice: 35, category: 'Metal' },
      { name: 'Gutter (Colorbond)', unit: 'm', defaultPrice: 28, category: 'Gutters' },
      { name: 'Downpipe', unit: 'm', defaultPrice: 22, category: 'Gutters' },
      { name: 'Whirlybird', unit: 'each', defaultPrice: 85, category: 'Ventilation' },
      { name: 'Roof Sealant', unit: 'tube', defaultPrice: 25, category: 'Repairs' },
    ],
    defaultRateCard: {
      hourlyRate: 85,
      calloutFee: 75,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Roofing Safety Checklist',
        items: [
          'Fall arrest system in place',
          'Harness inspected and worn',
          'Roof edge protection installed',
          'Weather conditions checked',
          'Ladder secured at base and top',
          'No working alone at heights',
          'Asbestos identification completed',
        ],
      },
    ],
    quoteCategories: ['Roof Repairs', 'Roof Restoration', 'Gutters & Downpipes', 'New Roofing', 'Ventilation'],
    invoicePaymentTerms: 14,
    licenseRequired: 'Builder License (for structural work)',
  },

  tiling: {
    id: 'tiling',
    name: 'Tiling',
    shortName: 'Tiler',
    icon: 'Grid3x3',
    color: '#0891b2',
    description: 'Floor and wall tiling services',
    typicalJobs: ['Bathroom tiling', 'Kitchen splashbacks', 'Floor tiling', 'Pool tiling', 'Outdoor tiling', 'Grout repairs'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'tileType', name: 'Tile Type', type: 'select', options: ['Ceramic', 'Porcelain', 'Natural Stone', 'Mosaic', 'Large Format'] },
      { id: 'tileSize', name: 'Tile Size', type: 'text', placeholder: 'e.g., 600x600mm' },
      { id: 'areaSize', name: 'Area Size', type: 'number', unit: 'm²' },
      { id: 'waterproofingRequired', name: 'Waterproofing Required', type: 'checkbox' },
      { id: 'groutColour', name: 'Grout Colour', type: 'text' },
    ],
    defaultMaterials: [
      { name: 'Tile Adhesive', unit: 'bag', defaultPrice: 45, category: 'Adhesives' },
      { name: 'Grout', unit: 'bag', defaultPrice: 35, category: 'Grout' },
      { name: 'Waterproofing Membrane', unit: 'L', defaultPrice: 85, category: 'Waterproofing' },
      { name: 'Tile Spacers', unit: 'pack', defaultPrice: 8, category: 'Accessories' },
      { name: 'Tile Trim (Aluminium)', unit: 'm', defaultPrice: 18, category: 'Trim' },
      { name: 'Silicone', unit: 'tube', defaultPrice: 18, category: 'Sealants' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Tiling Safety Checklist',
        items: [
          'Dust mask worn when cutting',
          'Safety glasses worn',
          'Wet saw guards in place',
          'Knee pads worn',
          'Area ventilated (adhesives/sealants)',
          'Sharp tiles disposed safely',
        ],
      },
    ],
    quoteCategories: ['Wall Tiling', 'Floor Tiling', 'Waterproofing', 'Splashbacks', 'Repairs & Regrout'],
    invoicePaymentTerms: 14,
  },

  concreting: {
    id: 'concreting',
    name: 'Concreting',
    shortName: 'Concreter',
    icon: 'Square',
    color: '#64748b',
    description: 'Concrete work, slabs, and foundations',
    typicalJobs: ['Driveways', 'Paths', 'Slabs', 'Retaining walls', 'Exposed aggregate', 'Stamped concrete'],
    terminology: { ...defaultTerminology },
    jobStages: [
      { id: 'pending', name: 'Quote Stage', description: 'Site assessment', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Pour date set', color: '#3b82f6' },
      { id: 'in_progress', name: 'Formwork/Pour', description: 'Concrete work', color: '#f59e0b' },
      { id: 'done', name: 'Cured', description: 'Curing complete', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'concreteType', name: 'Concrete Type', type: 'select', options: ['Standard Grey', 'Exposed Aggregate', 'Stamped/Stencil', 'Coloured', 'Polished'] },
      { id: 'mpaRating', name: 'MPA Rating', type: 'select', options: ['20 MPa', '25 MPa', '32 MPa', '40 MPa'] },
      { id: 'slabThickness', name: 'Slab Thickness', type: 'number', unit: 'mm' },
      { id: 'areaSize', name: 'Area Size', type: 'number', unit: 'm²' },
      { id: 'reinforcement', name: 'Reinforcement', type: 'select', options: ['None', 'Mesh', 'Rebar', 'Fibre'] },
    ],
    defaultMaterials: [
      { name: 'Concrete 25MPa', unit: 'm³', defaultPrice: 250, category: 'Concrete' },
      { name: 'Concrete 32MPa', unit: 'm³', defaultPrice: 280, category: 'Concrete' },
      { name: 'Reinforcing Mesh (SL82)', unit: 'sheet', defaultPrice: 65, category: 'Reinforcement' },
      { name: 'Rebar 12mm', unit: 'm', defaultPrice: 8, category: 'Reinforcement' },
      { name: 'Formwork Timber', unit: 'm', defaultPrice: 12, category: 'Formwork' },
      { name: 'Expansion Joint', unit: 'm', defaultPrice: 8, category: 'Joints' },
    ],
    defaultRateCard: {
      hourlyRate: 85,
      calloutFee: 0,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Concreting Safety Checklist',
        items: [
          'Underground services located',
          'PPE worn (gumboots, gloves, safety glasses)',
          'Concrete truck access clear',
          'Formwork secure',
          'First aid for concrete burns available',
          'Weather conditions checked',
        ],
      },
    ],
    quoteCategories: ['Driveways', 'Paths & Patios', 'Slabs', 'Retaining Walls', 'Decorative Finishes'],
    invoicePaymentTerms: 14,
  },

  fencing: {
    id: 'fencing',
    name: 'Fencing',
    shortName: 'Fencer',
    icon: 'Fence',
    color: '#854d0e',
    description: 'Fence installation and repairs',
    typicalJobs: ['Colorbond fencing', 'Timber fencing', 'Pool fencing', 'Gates', 'Retaining walls', 'Rural fencing'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'fenceType', name: 'Fence Type', type: 'select', options: ['Colorbond', 'Timber', 'Aluminium', 'Pool', 'Chain Link', 'Rural Wire'] },
      { id: 'fenceHeight', name: 'Fence Height', type: 'select', options: ['1.2m', '1.5m', '1.8m', '2.1m', '2.4m'] },
      { id: 'totalLength', name: 'Total Length', type: 'number', unit: 'm' },
      { id: 'gatesRequired', name: 'Gates Required', type: 'number' },
      { id: 'poolCompliant', name: 'Pool Compliant Required', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Colorbond Panel 1.8m', unit: 'm', defaultPrice: 95, category: 'Panels' },
      { name: 'Timber Paling', unit: 'each', defaultPrice: 4.50, category: 'Timber' },
      { name: 'Post (Steel)', unit: 'each', defaultPrice: 45, category: 'Posts' },
      { name: 'Post (Timber)', unit: 'each', defaultPrice: 28, category: 'Posts' },
      { name: 'Gate (Single)', unit: 'each', defaultPrice: 350, category: 'Gates' },
      { name: 'Concrete (Post Mix)', unit: 'bag', defaultPrice: 12, category: 'Concrete' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Fencing Safety Checklist',
        items: [
          'Underground services located (Dial Before You Dig)',
          'Property boundaries confirmed',
          'PPE worn',
          'Power tools inspected',
          'Neighbour notification (if required)',
          'Pool compliance requirements checked',
        ],
      },
    ],
    quoteCategories: ['Colorbond', 'Timber', 'Pool Fencing', 'Gates', 'Repairs', 'Rural'],
    invoicePaymentTerms: 14,
  },

  cleaning: {
    id: 'cleaning',
    name: 'Cleaning Services',
    shortName: 'Cleaner',
    icon: 'Sparkles',
    color: '#06b6d4',
    description: 'Professional cleaning and maintenance',
    typicalJobs: ['End of lease', 'Carpet cleaning', 'Window cleaning', 'Regular cleaning', 'Commercial cleaning', 'Pressure washing'],
    terminology: {
      job: 'Booking',
      jobs: 'Bookings',
      client: 'Client',
      clients: 'Clients',
      quote: 'Quote',
      quotes: 'Quotes',
      worksite: 'Property',
      worksites: 'Properties',
    },
    jobStages: [
      { id: 'pending', name: 'Enquiry', description: 'New request', color: '#6b7280' },
      { id: 'scheduled', name: 'Booked', description: 'Appointment set', color: '#3b82f6' },
      { id: 'in_progress', name: 'Cleaning', description: 'In progress', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Cleaning finished', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'propertyType', name: 'Property Type', type: 'select', options: ['House', 'Unit/Apartment', 'Office', 'Commercial', 'Industrial'] },
      { id: 'bedrooms', name: 'Bedrooms', type: 'number' },
      { id: 'bathrooms', name: 'Bathrooms', type: 'number' },
      { id: 'cleaningType', name: 'Cleaning Type', type: 'select', options: ['Regular', 'Deep Clean', 'End of Lease', 'Move-in', 'One-off'] },
      { id: 'frequency', name: 'Frequency', type: 'select', options: ['One-off', 'Weekly', 'Fortnightly', 'Monthly'] },
    ],
    defaultMaterials: [
      { name: 'Cleaning Supplies (Standard)', unit: 'set', defaultPrice: 35, category: 'Supplies' },
      { name: 'Carpet Cleaning', unit: 'room', defaultPrice: 45, category: 'Carpet' },
      { name: 'Oven Cleaning', unit: 'each', defaultPrice: 65, category: 'Appliances' },
      { name: 'Window Cleaning (per window)', unit: 'each', defaultPrice: 15, category: 'Windows' },
      { name: 'Pressure Washing', unit: 'm²', defaultPrice: 5, category: 'External' },
    ],
    defaultRateCard: {
      hourlyRate: 55,
      calloutFee: 0,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 10,
    },
    safetyChecklists: [
      {
        name: 'Cleaning Safety Checklist',
        items: [
          'Chemical safety labels read',
          'Gloves and PPE worn',
          'Wet floor signs placed',
          'Adequate ventilation',
          'Ladder safety (if required)',
          'Electrical safety around water',
        ],
      },
    ],
    quoteCategories: ['Regular Cleaning', 'Deep Clean', 'End of Lease', 'Carpet & Upholstery', 'Windows', 'External'],
    invoicePaymentTerms: 7,
  },

  handyman: {
    id: 'handyman',
    name: 'Handyman Services',
    shortName: 'Handyman',
    icon: 'Wrench',
    color: '#6b7280',
    description: 'General repairs and maintenance',
    typicalJobs: ['Door repairs', 'Furniture assembly', 'Picture hanging', 'Minor plumbing', 'Minor electrical', 'General repairs'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'jobType', name: 'Job Category', type: 'select', options: ['Repairs', 'Assembly', 'Installation', 'Maintenance', 'Multiple Tasks'] },
      { id: 'estimatedTime', name: 'Estimated Time', type: 'number', unit: 'hours' },
      { id: 'materialsIncluded', name: 'Materials Included', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'General Hardware Kit', unit: 'set', defaultPrice: 50, category: 'Hardware' },
      { name: 'Screws & Fixings Assorted', unit: 'pack', defaultPrice: 25, category: 'Hardware' },
      { name: 'Silicone Sealant', unit: 'tube', defaultPrice: 18, category: 'Sealants' },
      { name: 'Paint Touch-up', unit: 'can', defaultPrice: 35, category: 'Paint' },
    ],
    defaultRateCard: {
      hourlyRate: 65,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'General Safety Checklist',
        items: [
          'PPE appropriate for task',
          'Power tools inspected',
          'Work area clear',
          'First aid kit accessible',
          'Know limitations (licensed work)',
        ],
      },
    ],
    quoteCategories: ['Repairs', 'Assembly', 'Installation', 'Maintenance', 'Multiple Tasks'],
    invoicePaymentTerms: 7,
  },

  general: {
    id: 'general',
    name: 'General Trade Services',
    shortName: 'Tradie',
    icon: 'Wrench',
    color: '#6b7280',
    description: 'General trade and contractor services',
    typicalJobs: ['General repairs', 'Maintenance', 'Installations', 'Consultations', 'Custom work', 'Assessments'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'serviceType', name: 'Service Type', type: 'text', placeholder: 'Type of service provided' },
      { id: 'estimatedDuration', name: 'Estimated Duration', type: 'number', unit: 'hours' },
    ],
    defaultMaterials: [
      { name: 'General Materials', unit: 'lot', defaultPrice: 100, category: 'Materials' },
      { name: 'Hardware Supplies', unit: 'set', defaultPrice: 50, category: 'Hardware' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'General Safety Checklist',
        items: [
          'PPE appropriate for task',
          'Work area inspected',
          'Tools and equipment checked',
          'Emergency procedures known',
        ],
      },
    ],
    quoteCategories: ['Labour', 'Materials', 'Equipment', 'Travel', 'Other'],
    invoicePaymentTerms: 14,
  },

  grounds_maintenance: {
    id: 'grounds_maintenance',
    name: 'Grounds & Vegetation Management',
    shortName: 'Grounds Crew',
    icon: 'Leaf',
    color: '#15803d',
    description: 'Large-scale grounds, parks, and vegetation management',
    typicalJobs: ['Park maintenance', 'Vegetation clearing', 'Mowing contracts', 'Weed control', 'Tree management', 'Sports field maintenance'],
    terminology: {
      job: 'Work Order',
      jobs: 'Work Orders',
      client: 'Contract',
      clients: 'Contracts',
      quote: 'Tender',
      quotes: 'Tenders',
      worksite: 'Zone',
      worksites: 'Zones',
    },
    jobStages: [
      { id: 'pending', name: 'Assigned', description: 'Work order assigned', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Date allocated', color: '#3b82f6' },
      { id: 'in_progress', name: 'In Progress', description: 'Work underway', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Signed off', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Claimed', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'zoneId', name: 'Zone/Area ID', type: 'text' },
      { id: 'areaSize', name: 'Area Size', type: 'number', unit: 'hectares' },
      { id: 'serviceType', name: 'Service Type', type: 'select', options: ['Mowing', 'Vegetation Clearing', 'Weed Control', 'Tree Work', 'General Maintenance'] },
      { id: 'frequency', name: 'Service Frequency', type: 'select', options: ['As Required', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly'] },
      { id: 'contractNumber', name: 'Contract Number', type: 'text' },
      { id: 'beforePhoto', name: 'Before Photo Required', type: 'checkbox' },
      { id: 'afterPhoto', name: 'After Photo Required', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Herbicide (Roundup)', unit: 'L', defaultPrice: 45, category: 'Chemicals' },
      { name: 'Fuel', unit: 'L', defaultPrice: 2.20, category: 'Fuel' },
      { name: 'Mulch', unit: 'm³', defaultPrice: 85, category: 'Materials' },
      { name: 'Turf Repair', unit: 'm²', defaultPrice: 18, category: 'Turf' },
      { name: 'Tree Removal (Small)', unit: 'each', defaultPrice: 450, category: 'Trees' },
      { name: 'Stump Grinding', unit: 'each', defaultPrice: 250, category: 'Trees' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 0,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Grounds Maintenance Safety',
        items: [
          'SWMS/JSA reviewed and signed',
          'Traffic management plan in place',
          'PPE worn (hearing, eye, sun protection)',
          'Chainsaw safety gear (if tree work)',
          'Chemical handling procedures followed',
          'First aid kit and emergency plan accessible',
          'Equipment pre-start checks completed',
          'Public exclusion zones established',
        ],
      },
    ],
    quoteCategories: ['Mowing & Edging', 'Vegetation Clearing', 'Weed Control', 'Tree Management', 'Irrigation', 'Sports Fields'],
    invoicePaymentTerms: 30,
  },
};

export type TradeId = keyof typeof tradeCatalog;

export const getTradeDefinition = (tradeId: string): TradeDefinition | undefined => {
  return tradeCatalog[tradeId];
};

export const getAllTrades = (): TradeDefinition[] => {
  return Object.values(tradeCatalog);
};

export const getTradeOptions = (): { value: string; label: string }[] => {
  return Object.entries(tradeCatalog).map(([id, trade]) => ({
    value: id,
    label: trade.name,
  }));
};

export const getTradeTerminology = (tradeId: string): TradeTerminology => {
  const trade = tradeCatalog[tradeId];
  return trade?.terminology || defaultTerminology;
};

export const getTradeJobStages = (tradeId: string): TradeJobStage[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.jobStages || defaultJobStages;
};

export const getTradeCustomFields = (tradeId: string): TradeCustomField[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.customFields || [];
};

export const getTradeDefaultMaterials = (tradeId: string): TradeMaterial[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.defaultMaterials || [];
};

export const getTradeDefaultRateCard = (tradeId: string): TradeRateCard => {
  const trade = tradeCatalog[tradeId];
  return trade?.defaultRateCard || {
    hourlyRate: 75,
    calloutFee: 50,
    afterHoursMultiplier: 1.5,
    weekendMultiplier: 1.5,
    materialMarkupPct: 15,
  };
};

export const getTradeSafetyChecklists = (tradeId: string): TradeSafetyChecklist[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.safetyChecklists || [];
};

// Job Scope Templates - Comprehensive checklists for common job types
export const jobScopeTemplates: JobScopeTemplate[] = [
  // PLUMBING TEMPLATES
  {
    id: 'plumbing-hot-water-replacement',
    tradeId: 'plumbing',
    jobType: 'Hot Water System Replacement',
    description: 'Complete hot water system replacement including removal of old unit',
    icon: 'Flame',
    estimatedDuration: '3-4 hours',
    items: [
      { id: 'hwp-1', label: 'Site inspection & assessment', category: 'labour', required: true, tags: ['inspection', 'assessment'] },
      { id: 'hwp-2', label: 'Isolate water mains', category: 'safety', required: true, tags: ['isolation', 'safety'] },
      { id: 'hwp-3', label: 'Isolate power/gas supply', category: 'safety', required: true, tags: ['isolation', 'electrical', 'gas'] },
      { id: 'hwp-4', label: 'Drain existing system', category: 'labour', required: true, tags: ['removal'] },
      { id: 'hwp-5', label: 'Disconnect old unit', category: 'labour', required: true, tags: ['removal', 'disconnect'] },
      { id: 'hwp-6', label: 'Remove old hot water system', category: 'labour', required: true, tags: ['removal'] },
      { id: 'hwp-7', label: 'Disposal of old unit', category: 'disposal', estimatedPrice: 85, tags: ['disposal', 'waste'] },
      { id: 'hwp-8', label: 'New hot water unit', category: 'materials', unit: 'each', tags: ['equipment', 'hot water'] },
      { id: 'hwp-9', label: 'Install new unit', category: 'labour', required: true, tags: ['installation'] },
      { id: 'hwp-10', label: 'Connect water supply', category: 'labour', required: true, tags: ['connection', 'plumbing'] },
      { id: 'hwp-11', label: 'Connect power/gas', category: 'labour', required: true, tags: ['connection', 'electrical', 'gas'] },
      { id: 'hwp-12', label: 'Pressure relief valve', category: 'materials', unit: 'each', estimatedPrice: 45, tags: ['valve', 'safety'] },
      { id: 'hwp-13', label: 'Tempering valve (if required)', category: 'materials', unit: 'each', estimatedPrice: 120, tags: ['valve', 'compliance'] },
      { id: 'hwp-14', label: 'Flexi connectors', category: 'materials', defaultQty: 2, unit: 'each', estimatedPrice: 25, tags: ['fittings', 'connection'] },
      { id: 'hwp-15', label: 'Test system & check for leaks', category: 'labour', required: true, tags: ['testing', 'quality'] },
      { id: 'hwp-16', label: 'Set temperature', category: 'labour', required: true, tags: ['commissioning'] },
      { id: 'hwp-17', label: 'Certificate of Compliance', category: 'compliance', required: true, estimatedPrice: 0, tags: ['compliance', 'certificate', 'paperwork'] },
      { id: 'hwp-18', label: 'Customer handover & instructions', category: 'labour', tags: ['handover', 'training'] },
    ],
    commonlyMissed: ['Tempering valve', 'Certificate of Compliance', 'Disposal of old unit', 'Pressure relief valve'],
  },
  {
    id: 'plumbing-toilet-replacement',
    tradeId: 'plumbing',
    jobType: 'Toilet Suite Replacement',
    description: 'Remove and replace toilet suite with new unit',
    icon: 'Droplets',
    estimatedDuration: '1.5-2 hours',
    items: [
      { id: 'tr-1', label: 'Isolate water supply', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'tr-2', label: 'Disconnect cistern', category: 'labour', required: true, tags: ['disconnect'] },
      { id: 'tr-3', label: 'Remove old toilet pan', category: 'labour', required: true, tags: ['removal'] },
      { id: 'tr-4', label: 'Remove old pan collar', category: 'labour', tags: ['removal'] },
      { id: 'tr-5', label: 'Clean and prepare floor', category: 'labour', required: true, tags: ['preparation'] },
      { id: 'tr-6', label: 'New toilet suite', category: 'materials', unit: 'each', tags: ['fixture', 'toilet'] },
      { id: 'tr-7', label: 'New pan collar', category: 'materials', unit: 'each', estimatedPrice: 35, tags: ['fitting'] },
      { id: 'tr-8', label: 'Toilet seat (if not included)', category: 'materials', unit: 'each', estimatedPrice: 65, tags: ['fixture'] },
      { id: 'tr-9', label: 'Install pan & cistern', category: 'labour', required: true, tags: ['installation'] },
      { id: 'tr-10', label: 'Connect water supply', category: 'labour', required: true, tags: ['connection'] },
      { id: 'tr-11', label: 'Silicone seal around base', category: 'materials', unit: 'tube', estimatedPrice: 15, tags: ['sealant'] },
      { id: 'tr-12', label: 'Test flush & check for leaks', category: 'labour', required: true, tags: ['testing'] },
      { id: 'tr-13', label: 'Dispose of old toilet', category: 'disposal', estimatedPrice: 45, tags: ['disposal'] },
    ],
    commonlyMissed: ['Pan collar', 'Silicone seal', 'Disposal of old toilet'],
  },
  {
    id: 'plumbing-tap-replacement',
    tradeId: 'plumbing',
    jobType: 'Tap/Mixer Replacement',
    description: 'Replace kitchen or bathroom tap/mixer',
    icon: 'Droplets',
    estimatedDuration: '45 mins - 1.5 hours',
    items: [
      { id: 'tap-1', label: 'Isolate water supply', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'tap-2', label: 'Remove old tap/mixer', category: 'labour', required: true, tags: ['removal'] },
      { id: 'tap-3', label: 'Clean mounting surface', category: 'labour', tags: ['preparation'] },
      { id: 'tap-4', label: 'New tap/mixer', category: 'materials', unit: 'each', tags: ['tapware'] },
      { id: 'tap-5', label: 'Install new tap', category: 'labour', required: true, tags: ['installation'] },
      { id: 'tap-6', label: 'New flexi hoses', category: 'materials', defaultQty: 2, unit: 'each', estimatedPrice: 25, tags: ['fittings', 'hoses'] },
      { id: 'tap-7', label: 'Test operation & leaks', category: 'labour', required: true, tags: ['testing'] },
      { id: 'tap-8', label: 'Silicone seal (if required)', category: 'materials', unit: 'tube', estimatedPrice: 15, tags: ['sealant'] },
    ],
    commonlyMissed: ['New flexi hoses', 'Silicone seal'],
  },
  {
    id: 'plumbing-drain-blocked',
    tradeId: 'plumbing',
    jobType: 'Blocked Drain - Clear',
    description: 'Clear blocked drain using various methods',
    icon: 'Droplets',
    estimatedDuration: '1-3 hours',
    items: [
      { id: 'bd-1', label: 'Diagnose blockage location', category: 'labour', required: true, tags: ['diagnosis', 'inspection'] },
      { id: 'bd-2', label: 'CCTV drain camera inspection', category: 'labour', estimatedPrice: 195, tags: ['camera', 'inspection'] },
      { id: 'bd-3', label: 'Electric eel/drain snake', category: 'labour', estimatedPrice: 195, tags: ['clearing', 'equipment'] },
      { id: 'bd-4', label: 'High pressure water jetter', category: 'labour', estimatedPrice: 295, tags: ['jetting', 'clearing'] },
      { id: 'bd-5', label: 'Access pit/grate removal', category: 'labour', tags: ['access'] },
      { id: 'bd-6', label: 'Clear blockage', category: 'labour', required: true, tags: ['clearing'] },
      { id: 'bd-7', label: 'Test flow after clearing', category: 'labour', required: true, tags: ['testing'] },
      { id: 'bd-8', label: 'Provide CCTV footage report', category: 'compliance', tags: ['report', 'documentation'] },
      { id: 'bd-9', label: 'Recommendations for repairs (if needed)', category: 'compliance', tags: ['report'] },
    ],
    commonlyMissed: ['CCTV inspection', 'Footage report for client'],
  },
  {
    id: 'plumbing-gas-appliance-install',
    tradeId: 'plumbing',
    jobType: 'Gas Appliance Installation',
    description: 'Install gas cooktop, heater or BBQ point',
    icon: 'Flame',
    estimatedDuration: '2-4 hours',
    items: [
      { id: 'gas-1', label: 'Isolate gas supply', category: 'safety', required: true, tags: ['isolation', 'gas'] },
      { id: 'gas-2', label: 'Test for existing leaks', category: 'safety', required: true, tags: ['testing', 'safety'] },
      { id: 'gas-3', label: 'Run new gas line (if required)', category: 'labour', tags: ['installation', 'pipe'] },
      { id: 'gas-4', label: 'Gas pipe & fittings', category: 'materials', unit: 'lot', tags: ['materials', 'pipe'] },
      { id: 'gas-5', label: 'Install isolation valve', category: 'labour', required: true, tags: ['valve', 'isolation'] },
      { id: 'gas-6', label: 'Gas bayonet/connector', category: 'materials', unit: 'each', estimatedPrice: 85, tags: ['fitting', 'connection'] },
      { id: 'gas-7', label: 'Connect appliance', category: 'labour', required: true, tags: ['connection'] },
      { id: 'gas-8', label: 'Pressure test gas line', category: 'compliance', required: true, tags: ['testing', 'compliance'] },
      { id: 'gas-9', label: 'Leak test with soap solution', category: 'compliance', required: true, tags: ['testing', 'safety'] },
      { id: 'gas-10', label: 'Test appliance operation', category: 'labour', required: true, tags: ['testing', 'commissioning'] },
      { id: 'gas-11', label: 'Gas Certificate of Compliance', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate', 'compliance', 'paperwork'] },
    ],
    commonlyMissed: ['Gas Certificate of Compliance', 'Pressure test', 'Isolation valve'],
  },

  // ELECTRICAL TEMPLATES
  {
    id: 'electrical-powerpoint-install',
    tradeId: 'electrical',
    jobType: 'Power Point Installation',
    description: 'Install new power point (GPO) including cabling',
    icon: 'Zap',
    estimatedDuration: '1-2 hours',
    items: [
      { id: 'pp-1', label: 'Isolate circuit at switchboard', category: 'safety', required: true, tags: ['isolation', 'safety'] },
      { id: 'pp-2', label: 'Test for dead', category: 'safety', required: true, tags: ['testing', 'safety'] },
      { id: 'pp-3', label: 'Mark out position', category: 'labour', required: true, tags: ['preparation'] },
      { id: 'pp-4', label: 'Cut hole for back box', category: 'labour', required: true, tags: ['installation'] },
      { id: 'pp-5', label: 'Run cable from switchboard/junction', category: 'labour', required: true, tags: ['cabling'] },
      { id: 'pp-6', label: 'TPS Cable 2.5mm', category: 'materials', unit: 'm', estimatedPrice: 4.50, tags: ['cable', 'wiring'] },
      { id: 'pp-7', label: 'Power point (double GPO)', category: 'materials', unit: 'each', estimatedPrice: 35, tags: ['outlet', 'GPO'] },
      { id: 'pp-8', label: 'Back box', category: 'materials', unit: 'each', estimatedPrice: 8, tags: ['fitting'] },
      { id: 'pp-9', label: 'Cable clips', category: 'materials', unit: 'pack', estimatedPrice: 12, tags: ['fixings'] },
      { id: 'pp-10', label: 'Install & wire power point', category: 'labour', required: true, tags: ['installation', 'wiring'] },
      { id: 'pp-11', label: 'Connect at source', category: 'labour', required: true, tags: ['connection'] },
      { id: 'pp-12', label: 'Test circuit - polarity check', category: 'compliance', required: true, tags: ['testing', 'compliance'] },
      { id: 'pp-13', label: 'Test RCD operation', category: 'compliance', required: true, tags: ['testing', 'safety'] },
      { id: 'pp-14', label: 'Certificate of Compliance (EWOQ)', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate', 'compliance', 'paperwork'] },
      { id: 'pp-15', label: 'Patch any wall holes', category: 'labour', tags: ['finishing', 'repair'] },
    ],
    commonlyMissed: ['Certificate of Compliance', 'RCD test', 'Cable clips', 'Wall patching'],
  },
  {
    id: 'electrical-downlight-install',
    tradeId: 'electrical',
    jobType: 'LED Downlight Installation',
    description: 'Install LED downlights including cutting holes',
    icon: 'Lightbulb',
    estimatedDuration: '30-45 mins per light',
    items: [
      { id: 'dl-1', label: 'Isolate lighting circuit', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'dl-2', label: 'Test for dead', category: 'safety', required: true, tags: ['testing', 'safety'] },
      { id: 'dl-3', label: 'Locate ceiling joists', category: 'labour', required: true, tags: ['preparation'] },
      { id: 'dl-4', label: 'Mark out light positions', category: 'labour', required: true, tags: ['preparation', 'layout'] },
      { id: 'dl-5', label: 'Cut holes for downlights', category: 'labour', required: true, tags: ['installation'] },
      { id: 'dl-6', label: 'LED Downlight', category: 'materials', unit: 'each', estimatedPrice: 45, tags: ['light', 'LED', 'fixture'] },
      { id: 'dl-7', label: 'Run cables to each light', category: 'labour', required: true, tags: ['cabling'] },
      { id: 'dl-8', label: 'TPS Cable 1.5mm', category: 'materials', unit: 'm', estimatedPrice: 3.50, tags: ['cable'] },
      { id: 'dl-9', label: 'Connect driver/transformer', category: 'labour', required: true, tags: ['connection'] },
      { id: 'dl-10', label: 'Install & connect lights', category: 'labour', required: true, tags: ['installation'] },
      { id: 'dl-11', label: 'Check insulation clearance', category: 'compliance', required: true, tags: ['safety', 'insulation'] },
      { id: 'dl-12', label: 'Test all lights', category: 'compliance', required: true, tags: ['testing'] },
      { id: 'dl-13', label: 'Certificate of Compliance', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate', 'paperwork'] },
    ],
    commonlyMissed: ['Insulation clearance check', 'Certificate of Compliance', 'Locating joists'],
  },
  {
    id: 'electrical-switchboard-upgrade',
    tradeId: 'electrical',
    jobType: 'Switchboard Upgrade',
    description: 'Upgrade old switchboard to modern safety switch board',
    icon: 'Zap',
    estimatedDuration: '4-6 hours',
    items: [
      { id: 'sb-1', label: 'Pre-inspection of existing board', category: 'labour', required: true, tags: ['inspection'] },
      { id: 'sb-2', label: 'Notify power company (if required)', category: 'compliance', tags: ['notification', 'coordination'] },
      { id: 'sb-3', label: 'Isolate main supply', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'sb-4', label: 'Remove old switchboard', category: 'labour', required: true, tags: ['removal'] },
      { id: 'sb-5', label: 'Install new enclosure', category: 'labour', required: true, tags: ['installation'] },
      { id: 'sb-6', label: 'Switchboard enclosure', category: 'materials', unit: 'each', estimatedPrice: 250, tags: ['equipment'] },
      { id: 'sb-7', label: 'Main switch', category: 'materials', unit: 'each', estimatedPrice: 85, tags: ['switch'] },
      { id: 'sb-8', label: 'RCD Safety switch (30mA)', category: 'materials', unit: 'each', estimatedPrice: 95, tags: ['RCD', 'safety'] },
      { id: 'sb-9', label: 'Circuit breakers', category: 'materials', unit: 'each', estimatedPrice: 25, tags: ['breaker', 'protection'] },
      { id: 'sb-10', label: 'Surge protector (optional)', category: 'materials', unit: 'each', estimatedPrice: 180, tags: ['protection', 'surge'] },
      { id: 'sb-11', label: 'Neutral bar & earth bar', category: 'materials', unit: 'set', estimatedPrice: 45, tags: ['components'] },
      { id: 'sb-12', label: 'Rewire & connect all circuits', category: 'labour', required: true, tags: ['wiring'] },
      { id: 'sb-13', label: 'Label all circuits', category: 'compliance', required: true, tags: ['labelling', 'compliance'] },
      { id: 'sb-14', label: 'Test all RCDs', category: 'compliance', required: true, tags: ['testing', 'safety'] },
      { id: 'sb-15', label: 'Insulation resistance test', category: 'compliance', required: true, tags: ['testing'] },
      { id: 'sb-16', label: 'Earth continuity test', category: 'compliance', required: true, tags: ['testing', 'earth'] },
      { id: 'sb-17', label: 'Form 4 Certificate of Testing', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate', 'paperwork'] },
      { id: 'sb-18', label: 'Dispose of old switchboard', category: 'disposal', estimatedPrice: 45, tags: ['disposal'] },
    ],
    commonlyMissed: ['Form 4 Certificate', 'Circuit labelling', 'Surge protector', 'Earth continuity test'],
  },
  {
    id: 'electrical-ceiling-fan-install',
    tradeId: 'electrical',
    jobType: 'Ceiling Fan Installation',
    description: 'Install ceiling fan (replace light or new location)',
    icon: 'Fan',
    estimatedDuration: '1-2 hours',
    items: [
      { id: 'cf-1', label: 'Isolate circuit', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'cf-2', label: 'Test for dead', category: 'safety', required: true, tags: ['testing', 'safety'] },
      { id: 'cf-3', label: 'Check ceiling joist/structure', category: 'labour', required: true, tags: ['inspection', 'structure'] },
      { id: 'cf-4', label: 'Install fan brace (if needed)', category: 'labour', tags: ['installation', 'support'] },
      { id: 'cf-5', label: 'Ceiling fan brace kit', category: 'materials', unit: 'each', estimatedPrice: 45, tags: ['support', 'brace'] },
      { id: 'cf-6', label: 'Ceiling fan', category: 'materials', unit: 'each', estimatedPrice: 180, tags: ['fan', 'fixture'] },
      { id: 'cf-7', label: 'Remove old fitting', category: 'labour', tags: ['removal'] },
      { id: 'cf-8', label: 'Install mounting bracket', category: 'labour', required: true, tags: ['installation'] },
      { id: 'cf-9', label: 'Assemble fan', category: 'labour', required: true, tags: ['assembly'] },
      { id: 'cf-10', label: 'Wire & connect', category: 'labour', required: true, tags: ['wiring', 'connection'] },
      { id: 'cf-11', label: 'Balance fan blades', category: 'labour', required: true, tags: ['commissioning', 'balance'] },
      { id: 'cf-12', label: 'Test all speeds', category: 'compliance', required: true, tags: ['testing'] },
      { id: 'cf-13', label: 'Test light (if fitted)', category: 'compliance', tags: ['testing'] },
      { id: 'cf-14', label: 'Certificate of Compliance', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate'] },
    ],
    commonlyMissed: ['Fan brace kit', 'Balance blades', 'Certificate of Compliance'],
  },
  {
    id: 'electrical-smoke-alarm-install',
    tradeId: 'electrical',
    jobType: 'Smoke Alarm Installation',
    description: 'Install interconnected 240V smoke alarms (QLD compliance)',
    icon: 'Bell',
    estimatedDuration: '2-4 hours for full house',
    items: [
      { id: 'sa-1', label: 'Assess current compliance status', category: 'labour', required: true, tags: ['inspection', 'assessment'] },
      { id: 'sa-2', label: 'Determine alarm locations', category: 'labour', required: true, tags: ['planning', 'layout'] },
      { id: 'sa-3', label: 'Isolate circuit', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'sa-4', label: 'Run interconnect cable', category: 'labour', required: true, tags: ['cabling'] },
      { id: 'sa-5', label: 'TPS Cable 1.5mm', category: 'materials', unit: 'm', estimatedPrice: 3.50, tags: ['cable'] },
      { id: 'sa-6', label: 'Smoke alarm 240V (photoelectric)', category: 'materials', unit: 'each', estimatedPrice: 85, tags: ['alarm', 'smoke'] },
      { id: 'sa-7', label: 'Cut holes & install bases', category: 'labour', required: true, tags: ['installation'] },
      { id: 'sa-8', label: 'Wire all alarms', category: 'labour', required: true, tags: ['wiring'] },
      { id: 'sa-9', label: 'Test interconnection (all trigger together)', category: 'compliance', required: true, tags: ['testing', 'interconnect'] },
      { id: 'sa-10', label: 'Record serial numbers', category: 'compliance', required: true, tags: ['documentation'] },
      { id: 'sa-11', label: 'Certificate of Compliance', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate'] },
      { id: 'sa-12', label: 'Smoke alarm compliance statement', category: 'compliance', required: true, tags: ['compliance', 'documentation'] },
    ],
    commonlyMissed: ['Interconnection test', 'Compliance statement', 'Serial number recording'],
  },

  // HVAC TEMPLATES
  {
    id: 'hvac-split-system-install',
    tradeId: 'hvac',
    jobType: 'Split System AC Installation',
    description: 'Install split system air conditioner (supply & install)',
    icon: 'Wind',
    estimatedDuration: '4-6 hours',
    items: [
      { id: 'ac-1', label: 'Site inspection & placement planning', category: 'labour', required: true, tags: ['inspection', 'planning'] },
      { id: 'ac-2', label: 'Check electrical supply capacity', category: 'labour', required: true, tags: ['electrical', 'assessment'] },
      { id: 'ac-3', label: 'Split system unit', category: 'materials', unit: 'each', tags: ['equipment', 'AC'] },
      { id: 'ac-4', label: 'Install indoor unit bracket', category: 'labour', required: true, tags: ['installation'] },
      { id: 'ac-5', label: 'Cut hole through wall', category: 'labour', required: true, tags: ['installation'] },
      { id: 'ac-6', label: 'Mount indoor unit', category: 'labour', required: true, tags: ['installation'] },
      { id: 'ac-7', label: 'Install outdoor unit pad/bracket', category: 'labour', required: true, tags: ['installation'] },
      { id: 'ac-8', label: 'Outdoor unit bracket/pad', category: 'materials', unit: 'each', estimatedPrice: 85, tags: ['mounting'] },
      { id: 'ac-9', label: 'Run refrigerant lines', category: 'labour', required: true, tags: ['piping', 'refrigerant'] },
      { id: 'ac-10', label: 'Copper pipe pair coil', category: 'materials', unit: 'm', estimatedPrice: 28, tags: ['pipe', 'copper'] },
      { id: 'ac-11', label: 'Pipe insulation', category: 'materials', unit: 'm', estimatedPrice: 8, tags: ['insulation'] },
      { id: 'ac-12', label: 'Drain line', category: 'materials', unit: 'm', estimatedPrice: 5, tags: ['drainage'] },
      { id: 'ac-13', label: 'Install drain to appropriate location', category: 'labour', required: true, tags: ['drainage'] },
      { id: 'ac-14', label: 'Run electrical cable', category: 'labour', required: true, tags: ['electrical'] },
      { id: 'ac-15', label: 'Electrical cable 2.5mm', category: 'materials', unit: 'm', estimatedPrice: 6, tags: ['cable'] },
      { id: 'ac-16', label: 'Install isolator switch', category: 'labour', required: true, tags: ['electrical', 'isolation'] },
      { id: 'ac-17', label: 'Isolator switch', category: 'materials', unit: 'each', estimatedPrice: 45, tags: ['electrical'] },
      { id: 'ac-18', label: 'Vacuum refrigerant lines', category: 'labour', required: true, tags: ['commissioning'] },
      { id: 'ac-19', label: 'Release refrigerant & commission', category: 'labour', required: true, tags: ['commissioning', 'refrigerant'] },
      { id: 'ac-20', label: 'Test heating & cooling', category: 'compliance', required: true, tags: ['testing'] },
      { id: 'ac-21', label: 'Customer handover & operation training', category: 'labour', tags: ['handover'] },
      { id: 'ac-22', label: 'Certificate of Compliance (electrical)', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate'] },
      { id: 'ac-23', label: 'Pipe cover/duct (external)', category: 'materials', unit: 'm', estimatedPrice: 25, tags: ['finishing', 'cover'] },
    ],
    commonlyMissed: ['Isolator switch', 'Pipe cover', 'Electrical certificate', 'Vacuum lines'],
  },
  {
    id: 'hvac-service',
    tradeId: 'hvac',
    jobType: 'AC System Service',
    description: 'Standard service and clean of split system AC',
    icon: 'Wind',
    estimatedDuration: '45-60 mins per unit',
    items: [
      { id: 'sv-1', label: 'Isolate power', category: 'safety', required: true, tags: ['isolation'] },
      { id: 'sv-2', label: 'Remove and clean filters', category: 'labour', required: true, tags: ['cleaning', 'filter'] },
      { id: 'sv-3', label: 'Clean indoor coil', category: 'labour', required: true, tags: ['cleaning', 'coil'] },
      { id: 'sv-4', label: 'Coil cleaning solution', category: 'materials', unit: 'application', estimatedPrice: 25, tags: ['chemicals', 'cleaning'] },
      { id: 'sv-5', label: 'Clean fan barrel/blade', category: 'labour', required: true, tags: ['cleaning'] },
      { id: 'sv-6', label: 'Check drain line clear', category: 'labour', required: true, tags: ['inspection', 'drainage'] },
      { id: 'sv-7', label: 'Clean outdoor unit coil', category: 'labour', required: true, tags: ['cleaning', 'outdoor'] },
      { id: 'sv-8', label: 'Check refrigerant pressure', category: 'compliance', required: true, tags: ['testing', 'refrigerant'] },
      { id: 'sv-9', label: 'Check electrical connections', category: 'compliance', required: true, tags: ['inspection', 'electrical'] },
      { id: 'sv-10', label: 'Test operation all modes', category: 'compliance', required: true, tags: ['testing'] },
      { id: 'sv-11', label: 'Service report/sticker', category: 'compliance', required: true, tags: ['documentation'] },
      { id: 'sv-12', label: 'Replacement filter (if needed)', category: 'materials', unit: 'each', estimatedPrice: 35, tags: ['filter', 'replacement'] },
    ],
    commonlyMissed: ['Check refrigerant pressure', 'Clean outdoor coil', 'Service sticker'],
  },

  // BUILDING TEMPLATES
  {
    id: 'building-deck-construction',
    tradeId: 'building',
    jobType: 'Timber Deck Construction',
    description: 'Build timber deck including substructure and decking',
    icon: 'Hammer',
    estimatedDuration: '2-5 days depending on size',
    items: [
      { id: 'deck-1', label: 'Site measure & design', category: 'labour', required: true, tags: ['planning', 'design'] },
      { id: 'deck-2', label: 'Council/body corp approval (if required)', category: 'compliance', tags: ['approval', 'council'] },
      { id: 'deck-3', label: 'Call Before You Dig', category: 'safety', required: true, tags: ['safety', 'services'] },
      { id: 'deck-4', label: 'Set out & excavate footings', category: 'labour', required: true, tags: ['foundation'] },
      { id: 'deck-5', label: 'Concrete footings', category: 'materials', unit: 'each', estimatedPrice: 45, tags: ['concrete', 'foundation'] },
      { id: 'deck-6', label: 'Stirrups/post brackets', category: 'materials', unit: 'each', estimatedPrice: 25, tags: ['brackets', 'fixings'] },
      { id: 'deck-7', label: 'Posts (treated pine/hardwood)', category: 'materials', unit: 'each', tags: ['timber', 'structure'] },
      { id: 'deck-8', label: 'Bearers', category: 'materials', unit: 'm', tags: ['timber', 'structure'] },
      { id: 'deck-9', label: 'Joists', category: 'materials', unit: 'm', tags: ['timber', 'structure'] },
      { id: 'deck-10', label: 'Joist hangers', category: 'materials', unit: 'each', estimatedPrice: 8, tags: ['fixings'] },
      { id: 'deck-11', label: 'Decking boards', category: 'materials', unit: 'm²', tags: ['decking', 'finish'] },
      { id: 'deck-12', label: 'Deck screws', category: 'materials', unit: 'box', estimatedPrice: 65, tags: ['fixings'] },
      { id: 'deck-13', label: 'Install substructure', category: 'labour', required: true, tags: ['construction'] },
      { id: 'deck-14', label: 'Install decking', category: 'labour', required: true, tags: ['construction'] },
      { id: 'deck-15', label: 'Sand & finish (if hardwood)', category: 'labour', tags: ['finishing'] },
      { id: 'deck-16', label: 'Deck oil/stain', category: 'materials', unit: 'L', estimatedPrice: 45, tags: ['finishing', 'oil'] },
      { id: 'deck-17', label: 'Stairs (if required)', category: 'materials', unit: 'set', tags: ['stairs'] },
      { id: 'deck-18', label: 'Handrail (if required)', category: 'materials', unit: 'm', tags: ['balustrade', 'safety'] },
      { id: 'deck-19', label: 'Form 15/16 (if applicable)', category: 'compliance', tags: ['certificate', 'building'] },
    ],
    commonlyMissed: ['Council approval', 'Dial Before You Dig', 'Joist hangers', 'Deck oil', 'Building form'],
  },

  // ROOFING TEMPLATES
  {
    id: 'roofing-gutter-replacement',
    tradeId: 'roofing',
    jobType: 'Gutter & Fascia Replacement',
    description: 'Replace gutters and fascia boards',
    icon: 'Home',
    estimatedDuration: '1-2 days',
    items: [
      { id: 'gr-1', label: 'Access equipment setup', category: 'labour', required: true, tags: ['access', 'safety'] },
      { id: 'gr-2', label: 'Remove old gutters', category: 'labour', required: true, tags: ['removal'] },
      { id: 'gr-3', label: 'Remove old fascia (if required)', category: 'labour', tags: ['removal'] },
      { id: 'gr-4', label: 'Inspect/replace rotten timber', category: 'labour', tags: ['inspection', 'repair'] },
      { id: 'gr-5', label: 'Fascia board replacement', category: 'materials', unit: 'm', tags: ['fascia', 'timber'] },
      { id: 'gr-6', label: 'New gutter (Colorbond)', category: 'materials', unit: 'm', estimatedPrice: 28, tags: ['gutter'] },
      { id: 'gr-7', label: 'Internal/external corners', category: 'materials', unit: 'each', estimatedPrice: 18, tags: ['fittings'] },
      { id: 'gr-8', label: 'Stop ends', category: 'materials', unit: 'each', estimatedPrice: 12, tags: ['fittings'] },
      { id: 'gr-9', label: 'Downpipe', category: 'materials', unit: 'm', estimatedPrice: 22, tags: ['downpipe'] },
      { id: 'gr-10', label: 'Downpipe brackets', category: 'materials', unit: 'each', estimatedPrice: 8, tags: ['fixings'] },
      { id: 'gr-11', label: 'Install new gutters', category: 'labour', required: true, tags: ['installation'] },
      { id: 'gr-12', label: 'Install downpipes', category: 'labour', required: true, tags: ['installation'] },
      { id: 'gr-13', label: 'Seal all joints', category: 'labour', required: true, tags: ['sealing'] },
      { id: 'gr-14', label: 'Gutter sealant', category: 'materials', unit: 'tube', estimatedPrice: 18, tags: ['sealant'] },
      { id: 'gr-15', label: 'Test water flow', category: 'compliance', required: true, tags: ['testing'] },
      { id: 'gr-16', label: 'Disposal of old gutters', category: 'disposal', estimatedPrice: 65, tags: ['disposal'] },
      { id: 'gr-17', label: 'Gutter guard (optional)', category: 'materials', unit: 'm', estimatedPrice: 25, tags: ['guard', 'optional'] },
    ],
    commonlyMissed: ['Stop ends', 'Gutter sealant', 'Disposal', 'Check rotten fascia'],
  },

  // TILING TEMPLATES
  {
    id: 'tiling-bathroom-floor',
    tradeId: 'tiling',
    jobType: 'Bathroom Floor Tiling',
    description: 'Tile bathroom floor including waterproofing',
    icon: 'Grid3x3',
    estimatedDuration: '1-2 days',
    items: [
      { id: 'bf-1', label: 'Remove existing floor covering', category: 'labour', required: true, tags: ['removal'] },
      { id: 'bf-2', label: 'Prepare substrate', category: 'labour', required: true, tags: ['preparation'] },
      { id: 'bf-3', label: 'Waterproofing membrane', category: 'materials', unit: 'L', estimatedPrice: 85, tags: ['waterproofing'] },
      { id: 'bf-4', label: 'Apply waterproofing', category: 'labour', required: true, tags: ['waterproofing'] },
      { id: 'bf-5', label: 'Waterproof corners & shower base', category: 'labour', required: true, tags: ['waterproofing'] },
      { id: 'bf-6', label: 'Bond breaker tape', category: 'materials', unit: 'roll', estimatedPrice: 25, tags: ['waterproofing'] },
      { id: 'bf-7', label: 'Floor tiles', category: 'materials', unit: 'm²', tags: ['tiles'] },
      { id: 'bf-8', label: 'Tile adhesive', category: 'materials', unit: 'bag', estimatedPrice: 45, tags: ['adhesive'] },
      { id: 'bf-9', label: 'Lay tiles', category: 'labour', required: true, tags: ['installation'] },
      { id: 'bf-10', label: 'Tile spacers', category: 'materials', unit: 'pack', estimatedPrice: 8, tags: ['accessories'] },
      { id: 'bf-11', label: 'Grout', category: 'materials', unit: 'bag', estimatedPrice: 35, tags: ['grout'] },
      { id: 'bf-12', label: 'Grout tiles', category: 'labour', required: true, tags: ['grouting'] },
      { id: 'bf-13', label: 'Silicone all edges', category: 'labour', required: true, tags: ['sealing'] },
      { id: 'bf-14', label: 'Silicone', category: 'materials', unit: 'tube', estimatedPrice: 18, tags: ['sealant'] },
      { id: 'bf-15', label: 'Tile trim', category: 'materials', unit: 'm', estimatedPrice: 18, tags: ['trim', 'finishing'] },
      { id: 'bf-16', label: 'Disposal of old tiles', category: 'disposal', estimatedPrice: 85, tags: ['disposal'] },
      { id: 'bf-17', label: 'Waterproofing certificate', category: 'compliance', required: true, estimatedPrice: 0, tags: ['certificate', 'compliance'] },
    ],
    commonlyMissed: ['Waterproofing certificate', 'Bond breaker tape', 'Tile trim', 'Silicone edges'],
  },
];

// Search function for materials across all trades
export const searchCatalogItems = (
  query: string,
  tradeId?: string,
  category?: string
): { trade: string; material: TradeMaterial }[] => {
  const results: { trade: string; material: TradeMaterial }[] = [];
  const searchLower = query.toLowerCase();
  
  const tradesToSearch = tradeId ? [tradeCatalog[tradeId]].filter(Boolean) : Object.values(tradeCatalog);
  
  for (const trade of tradesToSearch) {
    for (const material of trade.defaultMaterials) {
      const matchesQuery = material.name.toLowerCase().includes(searchLower) ||
        material.category.toLowerCase().includes(searchLower);
      const matchesCategory = !category || material.category.toLowerCase() === category.toLowerCase();
      
      if (matchesQuery && matchesCategory) {
        results.push({ trade: trade.id, material });
      }
    }
  }
  
  return results;
};

// Get all categories for a trade
export const getTradeCategories = (tradeId: string): string[] => {
  const trade = tradeCatalog[tradeId];
  if (!trade) return [];
  
  const categories = new Set<string>();
  for (const material of trade.defaultMaterials) {
    categories.add(material.category);
  }
  return Array.from(categories).sort();
};

// Get job scope templates for a trade
export const getJobScopeTemplates = (tradeId: string): JobScopeTemplate[] => {
  return jobScopeTemplates.filter(t => t.tradeId === tradeId);
};

// Get a specific job scope template
export const getJobScopeTemplate = (templateId: string): JobScopeTemplate | undefined => {
  return jobScopeTemplates.find(t => t.id === templateId);
};

// Search job scope templates
export const searchJobScopeTemplates = (query: string, tradeId?: string): JobScopeTemplate[] => {
  const searchLower = query.toLowerCase();
  return jobScopeTemplates.filter(t => {
    const matchesTrade = !tradeId || t.tradeId === tradeId;
    const matchesQuery = t.jobType.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      t.items.some(item => 
        item.label.toLowerCase().includes(searchLower) ||
        item.tags?.some(tag => tag.includes(searchLower))
      );
    return matchesTrade && matchesQuery;
  });
};
