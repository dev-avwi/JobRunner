// NOTE: keep this file free of drizzle-orm/zod imports; the web frontend imports it
// directly (via @shared/safety-forms) to avoid bundling the full schema.

// ========================
// Australian WHS Safety Form Templates
// ========================

export const SWMS_TEMPLATE_FIELDS = [
  { id: 'project_name', type: 'text', label: 'Project/Job Name', required: true },
  { id: 'location', type: 'text', label: 'Work Location/Address', required: true },
  { id: 'date', type: 'date', label: 'Date of Work', required: true },
  { id: 'section_scope', type: 'section', label: 'Scope of Work' },
  { id: 'work_description', type: 'textarea', label: 'Description of High Risk Work', required: true, description: 'Describe the construction work to be performed' },
  { id: 'section_hazards', type: 'section', label: 'Hazard Identification' },
  { id: 'hazards_identified', type: 'textarea', label: 'Hazards Identified', required: true, description: 'List all hazards associated with this work' },
  { id: 'risk_level', type: 'select', label: 'Initial Risk Level', required: true, options: ['Low', 'Medium', 'High', 'Extreme'] },
  { id: 'section_controls', type: 'section', label: 'Control Measures' },
  { id: 'elimination_controls', type: 'textarea', label: 'Elimination Controls', description: 'Can the hazard be eliminated?' },
  { id: 'substitution_controls', type: 'textarea', label: 'Substitution Controls', description: 'Can a safer alternative be used?' },
  { id: 'engineering_controls', type: 'textarea', label: 'Engineering Controls', description: 'Physical controls (barriers, ventilation, etc.)' },
  { id: 'admin_controls', type: 'textarea', label: 'Administrative Controls', description: 'Procedures, training, signage, etc.' },
  { id: 'ppe_required', type: 'textarea', label: 'PPE Required', required: true, description: 'List all required personal protective equipment' },
  { id: 'residual_risk', type: 'select', label: 'Residual Risk Level', required: true, options: ['Low', 'Medium', 'High', 'Extreme'] },
  { id: 'section_emergency', type: 'section', label: 'Emergency Procedures' },
  { id: 'emergency_contacts', type: 'textarea', label: 'Emergency Contacts', required: true },
  { id: 'first_aid_location', type: 'text', label: 'First Aid Kit Location' },
  { id: 'evacuation_point', type: 'text', label: 'Emergency Assembly Point' },
  { id: 'section_workers', type: 'section', label: 'Worker Acknowledgement' },
  { id: 'workers_briefed', type: 'checkbox', label: 'All workers have been briefed on this SWMS', required: true },
  { id: 'induction_completed', type: 'checkbox', label: 'Site induction completed' },
  { id: 'competency_verified', type: 'checkbox', label: 'Worker competencies verified' },
] as const;

export const JSA_TEMPLATE_FIELDS = [
  { id: 'job_title', type: 'text', label: 'Job/Task Title', required: true },
  { id: 'location', type: 'text', label: 'Location', required: true },
  { id: 'date', type: 'date', label: 'Date', required: true },
  { id: 'supervisor', type: 'text', label: 'Supervisor Name', required: true },
  { id: 'section_steps', type: 'section', label: 'Job Steps & Hazards' },
  { id: 'step_1', type: 'textarea', label: 'Step 1: Task Description', required: true },
  { id: 'step_1_hazards', type: 'textarea', label: 'Step 1: Potential Hazards' },
  { id: 'step_1_controls', type: 'textarea', label: 'Step 1: Control Measures' },
  { id: 'step_2', type: 'textarea', label: 'Step 2: Task Description' },
  { id: 'step_2_hazards', type: 'textarea', label: 'Step 2: Potential Hazards' },
  { id: 'step_2_controls', type: 'textarea', label: 'Step 2: Control Measures' },
  { id: 'step_3', type: 'textarea', label: 'Step 3: Task Description' },
  { id: 'step_3_hazards', type: 'textarea', label: 'Step 3: Potential Hazards' },
  { id: 'step_3_controls', type: 'textarea', label: 'Step 3: Control Measures' },
  { id: 'section_ppe', type: 'section', label: 'Required PPE' },
  { id: 'ppe_hardhat', type: 'checkbox', label: 'Hard Hat' },
  { id: 'ppe_safety_glasses', type: 'checkbox', label: 'Safety Glasses' },
  { id: 'ppe_hearing', type: 'checkbox', label: 'Hearing Protection' },
  { id: 'ppe_gloves', type: 'checkbox', label: 'Gloves' },
  { id: 'ppe_boots', type: 'checkbox', label: 'Safety Boots' },
  { id: 'ppe_hivis', type: 'checkbox', label: 'Hi-Vis Vest/Clothing' },
  { id: 'ppe_respirator', type: 'checkbox', label: 'Respirator/Dust Mask' },
  { id: 'ppe_other', type: 'text', label: 'Other PPE Required' },
  { id: 'section_acknowledgement', type: 'section', label: 'Acknowledgement' },
  { id: 'reviewed_by_all', type: 'checkbox', label: 'This JSA has been reviewed with all workers', required: true },
] as const;

export const SAFETY_FORM_TYPES = {
  swms: {
    name: 'Safe Work Method Statement (SWMS)',
    description: 'Required for high-risk construction work under WHS regulations',
    fields: SWMS_TEMPLATE_FIELDS,
    requiresSignature: true,
    formType: 'safety' as const,
  },
  jsa: {
    name: 'Job Safety Analysis (JSA)',
    description: 'Step-by-step hazard analysis for work tasks',
    fields: JSA_TEMPLATE_FIELDS,
    requiresSignature: true,
    formType: 'safety' as const,
  },
  toolbox_talk: {
    name: 'Toolbox Talk Record',
    description: 'Record of safety briefing conducted with workers',
    fields: [
      { id: 'date', type: 'date', label: 'Date', required: true },
      { id: 'topic', type: 'text', label: 'Topic Discussed', required: true },
      { id: 'presenter', type: 'text', label: 'Presented By', required: true },
      { id: 'attendees', type: 'textarea', label: 'Attendees (Names)', required: true },
      { id: 'key_points', type: 'textarea', label: 'Key Points Discussed', required: true },
      { id: 'actions', type: 'textarea', label: 'Actions Required' },
      { id: 'questions', type: 'textarea', label: 'Questions Raised' },
    ],
    requiresSignature: true,
    formType: 'safety' as const,
  },
  site_inspection: {
    name: 'Site Safety Inspection',
    description: 'Routine safety inspection checklist',
    fields: [
      { id: 'date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector', type: 'text', label: 'Inspector Name', required: true },
      { id: 'section_general', type: 'section', label: 'General Site Conditions' },
      { id: 'access_clear', type: 'checkbox', label: 'Access/egress routes clear' },
      { id: 'housekeeping', type: 'checkbox', label: 'Good housekeeping maintained' },
      { id: 'signage_adequate', type: 'checkbox', label: 'Safety signage adequate' },
      { id: 'first_aid_available', type: 'checkbox', label: 'First aid kit available and stocked' },
      { id: 'fire_extinguisher', type: 'checkbox', label: 'Fire extinguisher accessible' },
      { id: 'section_hazards', type: 'section', label: 'Hazard Checks' },
      { id: 'electrical_safe', type: 'checkbox', label: 'Electrical leads/equipment safe' },
      { id: 'fall_protection', type: 'checkbox', label: 'Fall protection in place (if required)' },
      { id: 'ppe_worn', type: 'checkbox', label: 'Workers wearing required PPE' },
      { id: 'plant_safe', type: 'checkbox', label: 'Plant/equipment safe and maintained' },
      { id: 'hazardous_materials', type: 'checkbox', label: 'Hazardous materials stored correctly' },
      { id: 'issues_found', type: 'textarea', label: 'Issues/Hazards Found' },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions Required' },
    ],
    requiresSignature: true,
    formType: 'inspection' as const,
  },
} as const;

export type SafetyFormType = keyof typeof SAFETY_FORM_TYPES;
