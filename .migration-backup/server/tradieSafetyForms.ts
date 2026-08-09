/**
 * Trade-Specific Safety Checklists & Custom Forms
 * 
 * These are balanced, trade-appropriate safety forms that are:
 * - Australian WHS compliant
 * - Filtered by trade type
 * - Ready for digital signatures
 */

export interface SafetyFormDefinition {
  name: string;
  description: string;
  formType: 'safety' | 'compliance' | 'inspection';
  tradeType: string;
  requiresSignature: boolean;
  fields: Array<{
    id: string;
    type: 'checkbox' | 'text' | 'textarea' | 'select' | 'date' | 'signature';
    label: string;
    required?: boolean;
    options?: string[];
    placeholder?: string;
  }>;
  settings: {
    color: string;
    icon: string;
  };
}

// Generate checkbox fields from items
const createChecklistFields = (items: string[]): SafetyFormDefinition['fields'] => {
  return items.map((item, index) => ({
    id: `item_${index}`,
    type: 'checkbox' as const,
    label: item,
    required: true
  }));
};

// Standard footer fields for all safety forms
const standardFooterFields: SafetyFormDefinition['fields'] = [
  { id: 'comments', type: 'textarea', label: 'Additional Comments or Hazards Noted', placeholder: 'Enter any observations...' },
  { id: 'completedDate', type: 'date', label: 'Date Completed', required: true },
  { id: 'workerName', type: 'text', label: 'Worker Name', required: true },
];

export const tradieSafetyForms: SafetyFormDefinition[] = [
  // ============================================
  // ELECTRICAL (2 safety forms)
  // ============================================
  {
    name: 'Electrical Safety Checklist',
    description: 'Pre-work electrical safety assessment',
    formType: 'safety',
    tradeType: 'electrical',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Power isolated at switchboard',
        'Tested for dead with voltage tester',
        'Lock out/tag out procedures followed',
        'PPE worn (insulated gloves, safety glasses)',
        'Fire extinguisher accessible',
        'Work area clear of hazards',
        'Permit to work obtained (if required)',
        'Other workers notified of work'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#dc2626', icon: 'Zap' }
  },
  {
    name: 'Electrical Work Completion',
    description: 'Post-work electrical safety verification',
    formType: 'compliance',
    tradeType: 'electrical',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'All circuits tested and verified',
        'RCDs tested and operational',
        'Earth continuity verified',
        'Polarity correct',
        'Switchboard labelling updated',
        'Certificate of Compliance prepared',
        'Work area cleaned and restored',
        'Client safety briefing completed'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#dc2626', icon: 'CheckCircle' }
  },

  // ============================================
  // PLUMBING (2 safety forms)
  // ============================================
  {
    name: 'Plumbing Safety Checklist',
    description: 'Pre-work plumbing safety assessment',
    formType: 'safety',
    tradeType: 'plumbing',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Water supply isolated',
        'Gas supply isolated (if applicable)',
        'Hot water system isolated',
        'PPE worn (gloves, safety glasses)',
        'Drain camera inspection completed (if required)',
        'Asbestos check for older properties',
        'Work area ventilated',
        'Confined space procedures followed (if applicable)'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#2563eb', icon: 'Droplets' }
  },
  {
    name: 'Plumbing Work Completion',
    description: 'Post-work plumbing verification',
    formType: 'compliance',
    tradeType: 'plumbing',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'All connections leak tested',
        'Water pressure verified',
        'Gas connections leak tested (if applicable)',
        'Hot water temperature checked',
        'Drainage tested',
        'Compliance certificate prepared',
        'Work area cleaned',
        'Client water safety briefing completed'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#2563eb', icon: 'CheckCircle' }
  },

  // ============================================
  // CARPENTRY/BUILDING (2 safety forms)
  // ============================================
  {
    name: 'Building Site Safety Checklist',
    description: 'Daily site safety assessment',
    formType: 'safety',
    tradeType: 'carpentry',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Site secure and signage in place',
        'PPE available (hard hat, boots, glasses)',
        'Power tools inspected',
        'Ladders and scaffolding checked',
        'First aid kit accessible',
        'Work area clear of tripping hazards',
        'Weather conditions suitable',
        'Emergency exits clear'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#ea580c', icon: 'Hammer' }
  },
  {
    name: 'Working at Heights Checklist',
    description: 'Height safety assessment',
    formType: 'safety',
    tradeType: 'carpentry',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Fall protection equipment inspected',
        'Harness and lanyard in good condition',
        'Anchor points identified and secure',
        'Ladder secured at top and bottom',
        'Scaffolding inspected and tagged',
        'Edge protection in place',
        'Three points of contact maintained',
        'Weather conditions safe for height work'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#ea580c', icon: 'ArrowUp' }
  },

  // ============================================
  // PAINTING (2 safety forms)
  // ============================================
  {
    name: 'Painting Safety Checklist',
    description: 'Pre-work painting safety assessment',
    formType: 'safety',
    tradeType: 'painting',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Area ventilated adequately',
        'Respiratory protection available',
        'Drop sheets and protection in place',
        'Ladders and access equipment checked',
        'Paint products stored safely',
        'MSDS available for products',
        'Fire extinguisher accessible',
        'Lead paint test completed (if required)'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#7c3aed', icon: 'Paintbrush' }
  },
  {
    name: 'Lead Paint Assessment',
    description: 'Lead paint testing and safety',
    formType: 'compliance',
    tradeType: 'painting',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Building age assessed (pre-1970 check)',
        'Lead paint test conducted',
        'Test results documented',
        'Containment area established (if positive)',
        'Appropriate PPE worn',
        'HEPA vacuum available',
        'Waste disposal arranged',
        'Client notified of findings'
      ]),
      { id: 'testResult', type: 'select', label: 'Lead Test Result', options: ['Not Required', 'Negative', 'Positive'], required: true },
      ...standardFooterFields
    ],
    settings: { color: '#7c3aed', icon: 'AlertTriangle' }
  },

  // ============================================
  // HVAC (2 safety forms)
  // ============================================
  {
    name: 'HVAC Safety Checklist',
    description: 'Pre-work HVAC safety assessment',
    formType: 'safety',
    tradeType: 'hvac',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Power supply isolated',
        'Refrigerant recovery equipment ready',
        'Gas leak detector available',
        'PPE worn (gloves, safety glasses)',
        'Work area ventilated',
        'Electrical circuits tested',
        'Ladder/access equipment checked',
        'Refrigerant license verified'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#0891b2', icon: 'Thermometer' }
  },
  {
    name: 'HVAC Commissioning Checklist',
    description: 'System commissioning verification',
    formType: 'compliance',
    tradeType: 'hvac',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Refrigerant charge verified',
        'Airflow and temperature tested',
        'Thermostat calibrated',
        'Drain lines clear',
        'Electrical connections tight',
        'Outdoor unit level and secure',
        'Filter access demonstrated to client',
        'Warranty registration completed'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#0891b2', icon: 'CheckCircle' }
  },

  // ============================================
  // ROOFING (2 safety forms)
  // ============================================
  {
    name: 'Roofing Safety Checklist',
    description: 'Pre-work roofing safety assessment',
    formType: 'safety',
    tradeType: 'roofing',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Fall protection equipment inspected',
        'Harness fitted and adjusted',
        'Anchor points identified',
        'Roof condition assessed',
        'Weather conditions suitable',
        'Ladder secured properly',
        'PPE worn (hard hat, boots)',
        'Emergency plan in place'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#374151', icon: 'Home' }
  },
  {
    name: 'Asbestos Check - Roofing',
    description: 'Asbestos identification for roofing',
    formType: 'compliance',
    tradeType: 'roofing',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Property age assessed',
        'Visual inspection completed',
        'Suspected ACM identified',
        'Photos taken of suspect materials',
        'Client notified of findings',
        'Testing arranged (if required)',
        'Work plan adjusted for ACM',
        'Licensed removalist contacted (if required)'
      ]),
      { id: 'asbestosFound', type: 'select', label: 'Asbestos Assessment', options: ['None Found', 'Suspected - Testing Required', 'Confirmed Present'], required: true },
      ...standardFooterFields
    ],
    settings: { color: '#374151', icon: 'AlertTriangle' }
  },

  // ============================================
  // TILING (2 safety forms)
  // ============================================
  {
    name: 'Tiling Safety Checklist',
    description: 'Pre-work tiling safety assessment',
    formType: 'safety',
    tradeType: 'tiling',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Cutting area set up safely',
        'Wet saw guards in place',
        'PPE worn (safety glasses, mask, gloves)',
        'Work area ventilated',
        'Dust extraction available',
        'Power tools checked',
        'Adhesive and grout stored safely',
        'MSDS available for products'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#ca8a04', icon: 'Grid3X3' }
  },
  {
    name: 'Waterproofing Inspection',
    description: 'Waterproofing compliance checklist',
    formType: 'compliance',
    tradeType: 'tiling',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Substrate prepared correctly',
        'Primer applied where required',
        'Membrane applied to manufacturer specs',
        'Membrane thickness tested',
        'All corners and penetrations sealed',
        'Shower hob height correct',
        'Curing time observed',
        'Flood test completed (24 hours)'
      ]),
      { id: 'floodTestResult', type: 'select', label: 'Flood Test Result', options: ['Pass', 'Fail - Repairs Required'], required: true },
      ...standardFooterFields
    ],
    settings: { color: '#ca8a04', icon: 'CheckCircle' }
  },

  // ============================================
  // LANDSCAPING (2 safety forms)
  // ============================================
  {
    name: 'Landscaping Safety Checklist',
    description: 'Pre-work landscaping safety assessment',
    formType: 'safety',
    tradeType: 'landscaping',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Underground services located (Dial Before You Dig)',
        'PPE worn (gloves, boots, sun protection)',
        'Power equipment inspected',
        'Chainsaw license verified (if required)',
        'Work area secured',
        'Weather conditions suitable',
        'First aid kit accessible',
        'Client pets/children secured'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#16a34a', icon: 'Trees' }
  },
  {
    name: 'Excavation Safety Checklist',
    description: 'Excavation and earthworks safety',
    formType: 'safety',
    tradeType: 'landscaping',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Dial Before You Dig completed',
        'Underground services marked',
        'Shoring/support in place (if required)',
        'Excavation edges protected',
        'Access/egress established',
        'Soil stockpiled safely',
        'Traffic management in place',
        'Stormwater management considered'
      ]),
      { id: 'dbydReference', type: 'text', label: 'DBYD Reference Number', required: true },
      ...standardFooterFields
    ],
    settings: { color: '#16a34a', icon: 'Shovel' }
  },

  // ============================================
  // GENERAL (2 forms for all trades)
  // ============================================
  {
    name: 'General Site Safety Checklist',
    description: 'Universal pre-work safety assessment',
    formType: 'safety',
    tradeType: 'general',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'Site access checked',
        'Hazards identified and controlled',
        'PPE appropriate for task',
        'Tools and equipment inspected',
        'First aid kit accessible',
        'Emergency procedures known',
        'Client briefed on work',
        'Work area secured'
      ]),
      ...standardFooterFields
    ],
    settings: { color: '#6366f1', icon: 'Shield' }
  },
  {
    name: 'Job Completion Checklist',
    description: 'End of job verification',
    formType: 'compliance',
    tradeType: 'general',
    requiresSignature: true,
    fields: [
      ...createChecklistFields([
        'All work completed as quoted',
        'Quality checked and approved',
        'Work area cleaned',
        'Tools and materials removed',
        'Client walkthrough completed',
        'Photos taken for records',
        'Invoice prepared',
        'Warranty information provided'
      ]),
      { id: 'clientSatisfied', type: 'select', label: 'Client Satisfaction', options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Issues Noted'], required: true },
      ...standardFooterFields
    ],
    settings: { color: '#6366f1', icon: 'ClipboardCheck' }
  }
];
