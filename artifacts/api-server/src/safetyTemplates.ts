export const SAFETY_FORM_TEMPLATES = {
  swms: {
    name: 'Safe Work Method Statement (SWMS)',
    description: 'Australian standard SWMS template for high-risk construction work. Required under WHS regulations.',
    formType: 'safety',
    requiresSignature: true,
    fields: [
      { id: 'company_name', type: 'text', label: 'Company/Business Name', required: true },
      { id: 'abn', type: 'text', label: 'ABN', required: false },
      { id: 'project_name', type: 'text', label: 'Project/Job Name', required: true },
      { id: 'site_address', type: 'text', label: 'Site Address', required: true },
      { id: 'work_description', type: 'textarea', label: 'Description of Work Activity', required: true },
      { id: 'start_date', type: 'date', label: 'Start Date', required: true },
      { id: 'end_date', type: 'date', label: 'Expected Completion Date', required: false },
      { id: 'principal_contractor', type: 'text', label: 'Principal Contractor (if applicable)', required: false },
      {
        id: 'hazards_section',
        type: 'section',
        label: 'HAZARD IDENTIFICATION & RISK CONTROL',
        description: 'Identify all hazards associated with this work activity'
      },
      {
        id: 'hazards',
        type: 'checklist',
        label: 'Potential Hazards',
        options: [
          'Working at heights (above 2m)',
          'Electrical work/live services',
          'Excavation/trenching',
          'Hot work (welding/grinding)',
          'Confined spaces',
          'Manual handling/heavy lifting',
          'Working with asbestos',
          'Exposure to hazardous chemicals',
          'Mobile plant/machinery',
          'Traffic management',
          'Noise exposure',
          'Working in extreme temperatures',
          'Working near water',
          'Falling objects',
          'Slips, trips and falls',
          'Underground services'
        ],
        required: true
      },
      {
        id: 'control_measures',
        type: 'textarea',
        label: 'Control Measures to Eliminate/Minimise Risks',
        placeholder: 'List all control measures that will be implemented...',
        required: true
      },
      {
        id: 'ppe_section',
        type: 'section',
        label: 'PERSONAL PROTECTIVE EQUIPMENT (PPE)'
      },
      {
        id: 'ppe_required',
        type: 'checklist',
        label: 'PPE Required for this Work',
        options: [
          'Hard hat',
          'Safety glasses/goggles',
          'High visibility vest',
          'Steel cap boots',
          'Gloves (specify type)',
          'Hearing protection',
          'Dust mask/respirator',
          'Face shield',
          'Fall protection harness',
          'Sun protection'
        ],
        required: true
      },
      {
        id: 'emergency_section',
        type: 'section',
        label: 'EMERGENCY PROCEDURES'
      },
      { id: 'emergency_contact', type: 'text', label: 'Emergency Contact Name', required: true },
      { id: 'emergency_phone', type: 'tel', label: 'Emergency Phone Number', required: true },
      { id: 'first_aid_location', type: 'text', label: 'First Aid Kit Location', required: true },
      { id: 'assembly_point', type: 'text', label: 'Emergency Assembly Point', required: true },
      {
        id: 'consultation_section',
        type: 'section',
        label: 'WORKER CONSULTATION & SIGN-OFF',
        description: 'All workers must read, understand and sign this SWMS before commencing work'
      },
      { id: 'prepared_by', type: 'text', label: 'SWMS Prepared By', required: true },
      { id: 'prepared_date', type: 'date', label: 'Date Prepared', required: true },
      { id: 'reviewed_by', type: 'text', label: 'Reviewed By (Supervisor)', required: false },
      { id: 'worker_acknowledgement', type: 'checkbox', label: 'I have read and understood this SWMS and agree to follow all control measures', required: true }
    ],
    settings: {
      showLogo: true,
      includeWeatherConditions: true,
      autoPopulateFromJob: true
    }
  },

  jsa: {
    name: 'Job Safety Analysis (JSA)',
    description: 'Step-by-step safety analysis for job tasks. Identify hazards and controls for each step of the work.',
    formType: 'safety',
    requiresSignature: true,
    fields: [
      { id: 'job_title', type: 'text', label: 'Job/Task Title', required: true },
      { id: 'location', type: 'text', label: 'Location', required: true },
      { id: 'date', type: 'date', label: 'Date', required: true },
      { id: 'supervisor', type: 'text', label: 'Supervisor Name', required: true },
      {
        id: 'pre_start_section',
        type: 'section',
        label: 'PRE-START CHECKS'
      },
      {
        id: 'pre_start_checks',
        type: 'checklist',
        label: 'Pre-Start Safety Checks',
        options: [
          'Site induction completed',
          'Work area inspected and safe',
          'Tools and equipment checked',
          'PPE available and in good condition',
          'Permits obtained (if required)',
          'Workers briefed on hazards',
          'Emergency procedures known',
          'Weather conditions acceptable'
        ],
        required: true
      },
      {
        id: 'task_steps_section',
        type: 'section',
        label: 'TASK BREAKDOWN',
        description: 'Break down the job into steps and identify hazards for each step'
      },
      {
        id: 'step_1',
        type: 'group',
        label: 'Step 1',
        fields: [
          { id: 'step_1_task', type: 'text', label: 'Task/Activity', required: true },
          { id: 'step_1_hazards', type: 'textarea', label: 'Hazards Identified', required: true },
          { id: 'step_1_controls', type: 'textarea', label: 'Control Measures', required: true },
          { id: 'step_1_responsible', type: 'text', label: 'Person Responsible', required: false }
        ]
      },
      {
        id: 'step_2',
        type: 'group',
        label: 'Step 2',
        fields: [
          { id: 'step_2_task', type: 'text', label: 'Task/Activity', required: false },
          { id: 'step_2_hazards', type: 'textarea', label: 'Hazards Identified', required: false },
          { id: 'step_2_controls', type: 'textarea', label: 'Control Measures', required: false },
          { id: 'step_2_responsible', type: 'text', label: 'Person Responsible', required: false }
        ]
      },
      {
        id: 'step_3',
        type: 'group',
        label: 'Step 3',
        fields: [
          { id: 'step_3_task', type: 'text', label: 'Task/Activity', required: false },
          { id: 'step_3_hazards', type: 'textarea', label: 'Hazards Identified', required: false },
          { id: 'step_3_controls', type: 'textarea', label: 'Control Measures', required: false },
          { id: 'step_3_responsible', type: 'text', label: 'Person Responsible', required: false }
        ]
      },
      {
        id: 'additional_notes',
        type: 'textarea',
        label: 'Additional Safety Notes',
        required: false
      },
      {
        id: 'sign_off_section',
        type: 'section',
        label: 'SIGN-OFF'
      },
      { id: 'worker_name', type: 'text', label: 'Worker Name', required: true },
      { id: 'worker_acknowledgement', type: 'checkbox', label: 'I understand the hazards and will follow all control measures', required: true }
    ],
    settings: {
      showLogo: true,
      autoPopulateFromJob: true
    }
  },

  toolbox_talk: {
    name: 'Toolbox Talk Record',
    description: 'Record of safety briefing/toolbox talk conducted with workers before starting work.',
    formType: 'safety',
    requiresSignature: true,
    fields: [
      { id: 'date', type: 'date', label: 'Date', required: true },
      { id: 'time', type: 'time', label: 'Time', required: true },
      { id: 'location', type: 'text', label: 'Location', required: true },
      { id: 'conducted_by', type: 'text', label: 'Conducted By', required: true },
      {
        id: 'topics_section',
        type: 'section',
        label: 'TOPICS DISCUSSED'
      },
      {
        id: 'topics',
        type: 'checklist',
        label: 'Safety Topics Covered',
        options: [
          'Site hazards and risks',
          'PPE requirements',
          'Emergency procedures',
          'First aid locations',
          'Hot work permits',
          'Working at heights',
          'Manual handling',
          'Electrical safety',
          'Traffic management',
          'Weather conditions',
          'Incident reporting',
          'Housekeeping'
        ],
        required: true
      },
      { id: 'other_topics', type: 'textarea', label: 'Other Topics/Issues Discussed', required: false },
      { id: 'actions_required', type: 'textarea', label: 'Actions Required', required: false },
      {
        id: 'attendees_section',
        type: 'section',
        label: 'ATTENDEES',
        description: 'All workers present must sign to confirm attendance'
      },
      { id: 'attendee_count', type: 'number', label: 'Number of Attendees', required: true },
      { id: 'attendee_acknowledgement', type: 'checkbox', label: 'I attended this toolbox talk and understood the safety information presented', required: true }
    ],
    settings: {
      showLogo: true,
      multipleSignatures: true
    }
  },

  site_inspection: {
    name: 'Site Safety Inspection',
    description: 'Regular site safety inspection checklist to identify hazards and ensure compliance.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'site_name', type: 'text', label: 'Site/Project Name', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector_name', type: 'text', label: 'Inspector Name', required: true },
      { id: 'weather', type: 'select', label: 'Weather Conditions', options: ['Clear', 'Cloudy', 'Rain', 'Hot (>35°C)', 'Cold (<10°C)', 'Windy'], required: true },
      {
        id: 'housekeeping_section',
        type: 'section',
        label: 'HOUSEKEEPING'
      },
      {
        id: 'housekeeping',
        type: 'rating_checklist',
        label: 'Housekeeping Items',
        items: [
          'Work areas clean and tidy',
          'Walkways clear of obstructions',
          'Waste disposed of properly',
          'Materials stored safely',
          'Tools stored correctly'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'ppe_section',
        type: 'section',
        label: 'PPE COMPLIANCE'
      },
      {
        id: 'ppe_compliance',
        type: 'rating_checklist',
        label: 'PPE Items',
        items: [
          'Hard hats worn correctly',
          'Safety footwear worn',
          'Hi-vis vests worn',
          'Eye protection used where required',
          'Hearing protection used where required',
          'Gloves used where required'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'electrical_section',
        type: 'section',
        label: 'ELECTRICAL SAFETY'
      },
      {
        id: 'electrical',
        type: 'rating_checklist',
        label: 'Electrical Items',
        items: [
          'Power leads in good condition',
          'RCDs tested and tagged',
          'Tools tested and tagged',
          'Switchboards secured',
          'No exposed wiring'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'heights_section',
        type: 'section',
        label: 'WORKING AT HEIGHTS'
      },
      {
        id: 'heights',
        type: 'rating_checklist',
        label: 'Heights Safety Items',
        items: [
          'Scaffolding tagged and inspected',
          'Guardrails in place',
          'Ladders secured and in good condition',
          'Fall protection equipment available',
          'Edge protection in place'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'emergency_section',
        type: 'section',
        label: 'EMERGENCY PREPAREDNESS'
      },
      {
        id: 'emergency',
        type: 'rating_checklist',
        label: 'Emergency Items',
        items: [
          'First aid kit stocked and accessible',
          'Emergency exits clear',
          'Fire extinguisher accessible',
          'Emergency contacts displayed',
          'Evacuation plan displayed'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      { id: 'hazards_found', type: 'textarea', label: 'Hazards/Issues Identified', required: false },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions Required', required: false },
      { id: 'follow_up_date', type: 'date', label: 'Follow-up Date', required: false },
      { id: 'overall_rating', type: 'select', label: 'Overall Site Rating', options: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true
    }
  },

  prestart_equipment: {
    name: 'Pre-Start Equipment Inspection',
    description: 'Daily equipment pre-start checklist for plant, machinery, and power tools before use on site.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'equipment_type', type: 'select', label: 'Equipment Type', options: ['Excavator', 'Bobcat/Skid Steer', 'Scissor Lift', 'Boom Lift', 'Forklift', 'Crane', 'Generator', 'Compressor', 'Concrete Pump', 'Other'], required: true },
      { id: 'equipment_id', type: 'text', label: 'Equipment ID / Rego Number', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'operator_name', type: 'text', label: 'Operator Name', required: true },
      { id: 'hours_reading', type: 'text', label: 'Hours / Odometer Reading', required: false },
      {
        id: 'general_section',
        type: 'section',
        label: 'GENERAL CONDITION'
      },
      {
        id: 'general_checks',
        type: 'rating_checklist',
        label: 'General Items',
        items: [
          'Operator manual available',
          'Safety decals and labels legible',
          'Fire extinguisher charged and accessible',
          'First aid kit available',
          'No visible damage or defects',
          'All guards and covers in place'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'engine_section',
        type: 'section',
        label: 'ENGINE & FLUIDS'
      },
      {
        id: 'engine_checks',
        type: 'rating_checklist',
        label: 'Engine Items',
        items: [
          'Engine oil level adequate',
          'Coolant level adequate',
          'Hydraulic fluid level adequate',
          'No fluid leaks visible',
          'Air filter clean/serviceable',
          'Battery secure and terminals clean'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'safety_section',
        type: 'section',
        label: 'SAFETY SYSTEMS'
      },
      {
        id: 'safety_checks',
        type: 'rating_checklist',
        label: 'Safety Items',
        items: [
          'Seatbelt functional',
          'Horn operational',
          'Lights operational (front, rear, beacon)',
          'Reverse alarm/camera functional',
          'Emergency stop functional',
          'Brakes operational (service and park)'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'tyres_section',
        type: 'section',
        label: 'TYRES & TRACKS'
      },
      {
        id: 'tyres_checks',
        type: 'rating_checklist',
        label: 'Tyre/Track Items',
        items: [
          'Tyre pressure/track tension correct',
          'No cuts, cracks, or excessive wear',
          'Wheel nuts/bolts tight',
          'No track damage or missing pads'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      { id: 'defects_found', type: 'textarea', label: 'Defects / Issues Found', required: false },
      { id: 'action_taken', type: 'textarea', label: 'Action Taken', required: false },
      { id: 'fit_for_use', type: 'select', label: 'Equipment Fit for Use?', options: ['Yes - Safe to operate', 'No - Requires repair before use', 'Restricted use - See conditions'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true
    }
  },

  scaffold_inspection: {
    name: 'Scaffold Inspection',
    description: 'Scaffold handover and periodic inspection checklist per AS/NZS 4576 standards.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'scaffold_location', type: 'text', label: 'Scaffold Location / Description', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector_name', type: 'text', label: 'Inspector / Scaffolder Name', required: true },
      { id: 'inspection_type', type: 'select', label: 'Inspection Type', options: ['Initial Handover', 'Weekly Inspection', 'Post-Incident', 'Post-Weather Event', 'Modification Check'], required: true },
      { id: 'scaffold_type', type: 'select', label: 'Scaffold Type', options: ['Tube & Coupler', 'Modular/System', 'Mobile/Rolling', 'Cantilever', 'Suspended', 'Trestle'], required: true },
      { id: 'max_height', type: 'text', label: 'Maximum Height (metres)', required: true },
      {
        id: 'foundation_section',
        type: 'section',
        label: 'FOUNDATION & BASE'
      },
      {
        id: 'foundation_checks',
        type: 'rating_checklist',
        label: 'Foundation Items',
        items: [
          'Base plates on solid level ground',
          'Sole boards under base plates where required',
          'Standards plumb and level',
          'No undermining or washout around base'
        ],
        ratingOptions: ['Satisfactory', 'Needs Attention', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'structure_section',
        type: 'section',
        label: 'STRUCTURAL INTEGRITY'
      },
      {
        id: 'structure_checks',
        type: 'rating_checklist',
        label: 'Structure Items',
        items: [
          'All couplers/connections tight and secure',
          'Bracing installed correctly (plan and cross)',
          'Ties to structure at required intervals',
          'No damaged, bent, or corroded components',
          'Ledgers and transoms correctly positioned',
          'Load capacity not exceeded'
        ],
        ratingOptions: ['Satisfactory', 'Needs Attention', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'platform_section',
        type: 'section',
        label: 'PLATFORMS & ACCESS'
      },
      {
        id: 'platform_checks',
        type: 'rating_checklist',
        label: 'Platform Items',
        items: [
          'Platforms fully decked with no gaps > 25mm',
          'Guardrails at 900-1100mm height',
          'Mid-rails installed',
          'Toe boards in place (min 150mm)',
          'Safe access via ladder or stair tower',
          'Ladder extends 1m above platform level',
          'Trap doors or gates close after access'
        ],
        ratingOptions: ['Satisfactory', 'Needs Attention', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'signage_section',
        type: 'section',
        label: 'SIGNAGE & TAGS'
      },
      {
        id: 'signage_checks',
        type: 'rating_checklist',
        label: 'Signage Items',
        items: [
          'Scaffold tag displayed (green = safe, red = unsafe)',
          'Load rating sign displayed',
          'Incomplete scaffold signage where needed',
          'Exclusion zone signage at base'
        ],
        ratingOptions: ['Satisfactory', 'Needs Attention', 'Unsatisfactory', 'N/A']
      },
      { id: 'issues_found', type: 'textarea', label: 'Issues / Non-Conformances Found', required: false },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions Required', required: false },
      { id: 'scaffold_status', type: 'select', label: 'Scaffold Status', options: ['Safe to Use (Green Tag)', 'Unsafe - Do Not Use (Red Tag)', 'Requires Modification'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true
    }
  },

  electrical_inspection: {
    name: 'Electrical Installation Inspection',
    description: 'Pre-energisation and periodic electrical installation inspection checklist.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'site_address', type: 'text', label: 'Site Address', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'electrician_name', type: 'text', label: 'Licensed Electrician Name', required: true },
      { id: 'licence_number', type: 'text', label: 'Licence Number', required: true },
      { id: 'inspection_type', type: 'select', label: 'Inspection Type', options: ['New Installation', 'Alteration/Addition', 'Periodic Inspection', 'Fault Finding', 'Pre-Sale Inspection'], required: true },
      {
        id: 'switchboard_section',
        type: 'section',
        label: 'SWITCHBOARD'
      },
      {
        id: 'switchboard_checks',
        type: 'rating_checklist',
        label: 'Switchboard Items',
        items: [
          'Switchboard accessible and clear',
          'Circuit breakers labelled correctly',
          'RCDs installed and functional',
          'Main switch operational',
          'No signs of overheating or damage',
          'Cable entries properly sealed',
          'Adequate working space maintained'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'wiring_section',
        type: 'section',
        label: 'WIRING & CABLES'
      },
      {
        id: 'wiring_checks',
        type: 'rating_checklist',
        label: 'Wiring Items',
        items: [
          'Cable installation meets AS/NZS 3000',
          'Cable support and fixings adequate',
          'No damaged or exposed conductors',
          'Cable colours correct',
          'Junction boxes accessible and covered',
          'Earth conductors continuous and connected'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'power_section',
        type: 'section',
        label: 'POWER POINTS & OUTLETS'
      },
      {
        id: 'power_checks',
        type: 'rating_checklist',
        label: 'Power Point Items',
        items: [
          'GPOs installed at correct height',
          'Cover plates secure and undamaged',
          'Correct polarity verified',
          'Earth fault loop impedance tested',
          'Outdoor outlets weatherproof rated',
          'Dedicated circuits where required'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'lighting_section',
        type: 'section',
        label: 'LIGHTING'
      },
      {
        id: 'lighting_checks',
        type: 'rating_checklist',
        label: 'Lighting Items',
        items: [
          'Light fittings secure and undamaged',
          'Emergency lighting functional',
          'Exit signs illuminated',
          'Outdoor lighting weatherproof',
          'Sensor lights operational'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'testing_section',
        type: 'section',
        label: 'TESTING RESULTS'
      },
      { id: 'insulation_resistance', type: 'text', label: 'Insulation Resistance (MΩ)', required: false },
      { id: 'earth_continuity', type: 'text', label: 'Earth Continuity (Ω)', required: false },
      { id: 'rcd_trip_time', type: 'text', label: 'RCD Trip Time (ms)', required: false },
      { id: 'polarity_correct', type: 'select', label: 'Polarity Correct?', options: ['Yes', 'No'], required: true },
      { id: 'defects_found', type: 'textarea', label: 'Defects / Non-Compliances Found', required: false },
      { id: 'overall_result', type: 'select', label: 'Overall Result', options: ['Pass - Safe to Energise', 'Conditional Pass - Minor Works Required', 'Fail - Do Not Energise'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  },

  roof_safety_inspection: {
    name: 'Roof Safety Inspection',
    description: 'Roof access and edge protection safety inspection before commencing roof work.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'site_address', type: 'text', label: 'Site Address', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector_name', type: 'text', label: 'Inspector Name', required: true },
      { id: 'roof_type', type: 'select', label: 'Roof Type', options: ['Metal (Colorbond)', 'Tile (Concrete)', 'Tile (Terracotta)', 'Slate', 'Flat/Membrane', 'Polycarbonate/Fibreglass', 'Other'], required: true },
      { id: 'roof_pitch', type: 'select', label: 'Roof Pitch', options: ['Flat (0-5°)', 'Low (5-15°)', 'Medium (15-25°)', 'Steep (25-35°)', 'Very Steep (>35°)'], required: true },
      {
        id: 'access_section',
        type: 'section',
        label: 'ACCESS & EDGE PROTECTION'
      },
      {
        id: 'access_checks',
        type: 'rating_checklist',
        label: 'Access Items',
        items: [
          'Safe access to roof (ladder/scaffold/EWP)',
          'Ladder secured and extending 1m above roof edge',
          'Edge protection installed on all open sides',
          'Penetration covers in place (skylights, openings)',
          'Anchor points available and rated',
          'Safety mesh installed where required'
        ],
        ratingOptions: ['Satisfactory', 'Not in Place', 'N/A']
      },
      {
        id: 'conditions_section',
        type: 'section',
        label: 'ROOF CONDITIONS'
      },
      {
        id: 'conditions_checks',
        type: 'rating_checklist',
        label: 'Condition Items',
        items: [
          'Roof surface dry and not slippery',
          'No fragile or deteriorated areas',
          'Gutters and downpipes clear',
          'No overhead power lines nearby',
          'Wind conditions acceptable (<40km/h)',
          'Adequate lighting for work'
        ],
        ratingOptions: ['Satisfactory', 'Not Satisfactory', 'N/A']
      },
      {
        id: 'ppe_section',
        type: 'section',
        label: 'PPE & FALL PREVENTION'
      },
      {
        id: 'ppe_checks',
        type: 'rating_checklist',
        label: 'PPE Items',
        items: [
          'Fall arrest harness worn and inspected',
          'Lanyard/inertia reel connected to anchor',
          'Non-slip footwear worn',
          'Hard hat worn',
          'Hi-vis vest worn',
          'Tool lanyards in use'
        ],
        ratingOptions: ['Yes', 'No', 'N/A']
      },
      { id: 'exclusion_zone', type: 'select', label: 'Exclusion Zone Established Below?', options: ['Yes', 'No', 'Not Required'], required: true },
      { id: 'hazards_found', type: 'textarea', label: 'Hazards / Issues Identified', required: false },
      { id: 'safe_to_proceed', type: 'select', label: 'Safe to Proceed with Roof Work?', options: ['Yes - All controls in place', 'No - Additional controls required', 'No - Work postponed'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true
    }
  },

  confined_space_permit: {
    name: 'Confined Space Entry Permit',
    description: 'Pre-entry confined space inspection and permit checklist per AS 2865.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'space_location', type: 'text', label: 'Confined Space Location / Description', required: true },
      { id: 'permit_date', type: 'date', label: 'Permit Date', required: true },
      { id: 'permit_valid_until', type: 'text', label: 'Permit Valid Until (time)', required: true },
      { id: 'entrant_names', type: 'textarea', label: 'Names of Entrants', required: true },
      { id: 'standby_person', type: 'text', label: 'Standby Person Name', required: true },
      { id: 'purpose_of_entry', type: 'textarea', label: 'Purpose of Entry', required: true },
      {
        id: 'atmosphere_section',
        type: 'section',
        label: 'ATMOSPHERIC TESTING'
      },
      { id: 'oxygen_level', type: 'text', label: 'Oxygen Level (% — safe range 19.5-23.5%)', required: true },
      { id: 'lel_reading', type: 'text', label: 'LEL Reading (% — must be <5%)', required: true },
      { id: 'h2s_reading', type: 'text', label: 'H2S Reading (ppm — must be <10)', required: false },
      { id: 'co_reading', type: 'text', label: 'CO Reading (ppm — must be <30)', required: false },
      {
        id: 'precautions_section',
        type: 'section',
        label: 'PRE-ENTRY PRECAUTIONS'
      },
      {
        id: 'precaution_checks',
        type: 'rating_checklist',
        label: 'Pre-Entry Items',
        items: [
          'Space isolated from all energy sources',
          'Lockout/tagout applied',
          'Space purged/ventilated',
          'Atmospheric monitoring continuous',
          'Rescue plan established',
          'Communication system in place',
          'Standby person briefed and in position',
          'Emergency services notified (if required)',
          'All entrants briefed on hazards and procedures'
        ],
        ratingOptions: ['Yes', 'No', 'N/A']
      },
      {
        id: 'equipment_section',
        type: 'section',
        label: 'EQUIPMENT & PPE'
      },
      {
        id: 'equipment_checks',
        type: 'rating_checklist',
        label: 'Equipment Items',
        items: [
          'Gas detector calibrated and functional',
          'Breathing apparatus available (if required)',
          'Rescue tripod/winch in position',
          'Harness and lifeline available',
          'Explosion-proof lighting available',
          'First aid kit accessible',
          'Fire extinguisher accessible'
        ],
        ratingOptions: ['Yes', 'No', 'N/A']
      },
      { id: 'additional_hazards', type: 'textarea', label: 'Additional Hazards Identified', required: false },
      { id: 'entry_approved', type: 'select', label: 'Entry Approved?', options: ['Yes - Safe to Enter', 'No - Entry Prohibited'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  },

  vehicle_prestart: {
    name: 'Vehicle / Plant Pre-Start',
    description: 'Daily pre-start inspection checklist for work vehicles, utes, and light plant.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'vehicle_type', type: 'select', label: 'Vehicle Type', options: ['Ute/Pickup', 'Van', 'Truck (<4.5t)', 'Truck (>4.5t)', 'Trailer', 'Other'], required: true },
      { id: 'rego_number', type: 'text', label: 'Registration Number', required: true },
      { id: 'odometer', type: 'text', label: 'Odometer Reading (km)', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'driver_name', type: 'text', label: 'Driver Name', required: true },
      {
        id: 'exterior_section',
        type: 'section',
        label: 'EXTERIOR'
      },
      {
        id: 'exterior_checks',
        type: 'rating_checklist',
        label: 'Exterior Items',
        items: [
          'Tyres adequate tread and pressure',
          'No body damage or sharp edges',
          'Lights and indicators functional',
          'Mirrors clean and adjusted',
          'Number plates clean and visible',
          'Load secured (if applicable)'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'interior_section',
        type: 'section',
        label: 'INTERIOR & CABIN'
      },
      {
        id: 'interior_checks',
        type: 'rating_checklist',
        label: 'Interior Items',
        items: [
          'Seatbelts functional for all seats',
          'Windscreen clean and undamaged',
          'Wipers operational',
          'Horn operational',
          'Dashboard warning lights clear',
          'Cabin clean and tidy'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'fluids_section',
        type: 'section',
        label: 'UNDER BONNET'
      },
      {
        id: 'fluids_checks',
        type: 'rating_checklist',
        label: 'Fluid Items',
        items: [
          'Engine oil level adequate',
          'Coolant level adequate',
          'Brake fluid level adequate',
          'Washer fluid level adequate',
          'No visible leaks',
          'Battery secure'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'safety_section',
        type: 'section',
        label: 'SAFETY EQUIPMENT'
      },
      {
        id: 'safety_checks',
        type: 'rating_checklist',
        label: 'Safety Items',
        items: [
          'First aid kit stocked',
          'Fire extinguisher charged',
          'Warning triangle/cones available',
          'Hi-vis vest available',
          'Spill kit available (if carrying fluids)'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      { id: 'defects_found', type: 'textarea', label: 'Defects / Issues Found', required: false },
      { id: 'vehicle_fit', type: 'select', label: 'Vehicle Fit for Use?', options: ['Yes', 'No - Requires Repair', 'Restricted Use'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true
    }
  },

  fire_safety_inspection: {
    name: 'Fire Safety Inspection',
    description: 'Monthly fire safety equipment and emergency exit inspection checklist.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'building_name', type: 'text', label: 'Building / Site Name', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector_name', type: 'text', label: 'Inspector Name', required: true },
      {
        id: 'extinguisher_section',
        type: 'section',
        label: 'FIRE EXTINGUISHERS'
      },
      {
        id: 'extinguisher_checks',
        type: 'rating_checklist',
        label: 'Extinguisher Items',
        items: [
          'All extinguishers in designated locations',
          'Extinguishers accessible (not blocked)',
          'Pressure gauges in green zone',
          'Safety pins and seals intact',
          'Service tags current (within 6 months)',
          'Correct type for area (water/foam/CO2/powder)'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'exits_section',
        type: 'section',
        label: 'EMERGENCY EXITS & ROUTES'
      },
      {
        id: 'exits_checks',
        type: 'rating_checklist',
        label: 'Exit Items',
        items: [
          'All emergency exits clearly marked',
          'Exit signs illuminated and functional',
          'Exit doors open freely (not locked/blocked)',
          'Evacuation routes clear of obstructions',
          'Assembly point signage in place',
          'Emergency lighting functional'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'detection_section',
        type: 'section',
        label: 'DETECTION & ALARM SYSTEMS'
      },
      {
        id: 'detection_checks',
        type: 'rating_checklist',
        label: 'Detection Items',
        items: [
          'Smoke detectors functional (tested)',
          'Fire alarm panel showing normal',
          'Manual call points accessible',
          'Sprinkler system gauge readings normal',
          'Fire doors close fully and latch'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      {
        id: 'general_section',
        type: 'section',
        label: 'GENERAL FIRE SAFETY'
      },
      {
        id: 'general_checks',
        type: 'rating_checklist',
        label: 'General Items',
        items: [
          'Evacuation plan displayed',
          'Fire warden list current',
          'Flammable materials stored correctly',
          'Electrical switchboard accessible',
          'No overloaded power points',
          'Hot work permit system in place (if applicable)'
        ],
        ratingOptions: ['Pass', 'Fail', 'N/A']
      },
      { id: 'issues_found', type: 'textarea', label: 'Issues / Non-Compliances Found', required: false },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions Required', required: false },
      { id: 'next_inspection', type: 'date', label: 'Next Inspection Due', required: false },
      { id: 'overall_status', type: 'select', label: 'Overall Fire Safety Status', options: ['Compliant', 'Minor Non-Compliance', 'Major Non-Compliance', 'Critical - Immediate Action Required'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  },

  quality_assurance: {
    name: 'Quality Assurance Inspection',
    description: 'Workmanship quality checklist for job handover, defect identification, and client sign-off.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'project_name', type: 'text', label: 'Project / Job Name', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector_name', type: 'text', label: 'Inspector / Supervisor Name', required: true },
      { id: 'trade_work', type: 'select', label: 'Trade / Work Type', options: ['Electrical', 'Plumbing', 'Carpentry', 'Painting', 'Tiling', 'Plastering', 'Roofing', 'Landscaping', 'General Building', 'Other'], required: true },
      { id: 'stage', type: 'select', label: 'Inspection Stage', options: ['Pre-Handover', 'Practical Completion', 'Defect Inspection', 'Final Sign-Off', 'Progress Check'], required: true },
      {
        id: 'workmanship_section',
        type: 'section',
        label: 'WORKMANSHIP QUALITY'
      },
      {
        id: 'workmanship_checks',
        type: 'rating_checklist',
        label: 'Workmanship Items',
        items: [
          'Work completed to specification/plan',
          'Materials match specifications',
          'Finishes clean and professional',
          'Joints and connections neat',
          'Alignments straight and level',
          'No visible defects or damage'
        ],
        ratingOptions: ['Excellent', 'Acceptable', 'Defect - Rework Required', 'N/A']
      },
      {
        id: 'compliance_section',
        type: 'section',
        label: 'COMPLIANCE & STANDARDS'
      },
      {
        id: 'compliance_checks',
        type: 'rating_checklist',
        label: 'Compliance Items',
        items: [
          'Work meets Australian Standards',
          'Work matches approved plans',
          'Required certifications obtained',
          'Testing completed and documented',
          'Warranty documentation provided'
        ],
        ratingOptions: ['Yes', 'No', 'Pending', 'N/A']
      },
      {
        id: 'cleanup_section',
        type: 'section',
        label: 'SITE CLEANUP'
      },
      {
        id: 'cleanup_checks',
        type: 'rating_checklist',
        label: 'Cleanup Items',
        items: [
          'Work area cleaned and swept',
          'All rubbish removed from site',
          'Protective coverings removed',
          'Tools and equipment removed',
          'No damage to existing surfaces/fixtures',
          'Client property left clean'
        ],
        ratingOptions: ['Satisfactory', 'Needs Attention', 'Unsatisfactory']
      },
      { id: 'defects_list', type: 'textarea', label: 'Defects / Items to Rectify', required: false },
      { id: 'rectification_deadline', type: 'date', label: 'Rectification Deadline', required: false },
      { id: 'client_comments', type: 'textarea', label: 'Client Comments', required: false },
      { id: 'overall_quality', type: 'select', label: 'Overall Quality Rating', options: ['Excellent', 'Good', 'Acceptable', 'Below Standard', 'Unacceptable'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  },

  incident_report: {
    name: 'Incident/Near Miss Report',
    description: 'Report workplace incidents, injuries, or near misses as required by WHS regulations.',
    formType: 'compliance',
    requiresSignature: true,
    fields: [
      {
        id: 'incident_type_section',
        type: 'section',
        label: 'INCIDENT CLASSIFICATION'
      },
      {
        id: 'incident_type',
        type: 'select',
        label: 'Type of Incident',
        options: ['Injury/Illness', 'Near Miss', 'Property Damage', 'Environmental Incident', 'Vehicle Incident'],
        required: true
      },
      {
        id: 'severity',
        type: 'select',
        label: 'Severity',
        options: ['Minor (First Aid)', 'Moderate (Medical Treatment)', 'Serious (Lost Time)', 'Critical (Notifiable)'],
        required: true
      },
      {
        id: 'details_section',
        type: 'section',
        label: 'INCIDENT DETAILS'
      },
      { id: 'incident_date', type: 'date', label: 'Date of Incident', required: true },
      { id: 'incident_time', type: 'time', label: 'Time of Incident', required: true },
      { id: 'location', type: 'text', label: 'Location of Incident', required: true },
      { id: 'description', type: 'textarea', label: 'Description of Incident', placeholder: 'Describe what happened in detail...', required: true },
      {
        id: 'person_section',
        type: 'section',
        label: 'PERSON(S) INVOLVED'
      },
      { id: 'injured_name', type: 'text', label: 'Name of Injured Person (if applicable)', required: false },
      { id: 'injury_type', type: 'text', label: 'Type of Injury', required: false },
      { id: 'treatment', type: 'textarea', label: 'Treatment Provided', required: false },
      {
        id: 'investigation_section',
        type: 'section',
        label: 'INVESTIGATION'
      },
      { id: 'immediate_cause', type: 'textarea', label: 'Immediate Cause', required: true },
      { id: 'underlying_cause', type: 'textarea', label: 'Underlying/Root Cause', required: false },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions to Prevent Recurrence', required: true },
      { id: 'action_owner', type: 'text', label: 'Action Owner', required: true },
      { id: 'completion_date', type: 'date', label: 'Target Completion Date', required: true },
      {
        id: 'reporting_section',
        type: 'section',
        label: 'REPORTING'
      },
      { id: 'reported_to_regulator', type: 'checkbox', label: 'Reported to WorkSafe (if notifiable)', required: false },
      { id: 'reported_by', type: 'text', label: 'Report Completed By', required: true },
      { id: 'report_date', type: 'date', label: 'Date of Report', required: true }
    ],
    settings: {
      showLogo: true,
      notifyOwner: true,
      generatePdfReport: true
    }
  },

  electrical_test_tag: {
    name: 'Electrical Test & Tag Certificate',
    description: 'Portable appliance testing and tagging record for WHS compliance. Required under AS/NZS 3760:2022.',
    formType: 'compliance',
    requiresSignature: true,
    fields: [
      {
        id: 'business_section',
        type: 'section',
        label: 'BUSINESS DETAILS'
      },
      { id: 'business_name', type: 'text', label: 'Business Name', required: true },
      { id: 'technician_name', type: 'text', label: 'Technician Name', required: true },
      { id: 'licence_number', type: 'text', label: 'Electrical Licence Number', required: true },
      {
        id: 'test_dates_section',
        type: 'section',
        label: 'TEST DATES'
      },
      { id: 'test_date', type: 'date', label: 'Test Date', required: true },
      { id: 'next_test_due', type: 'date', label: 'Next Test Due', required: true },
      {
        id: 'appliance_section',
        type: 'section',
        label: 'APPLIANCE DETAILS'
      },
      { id: 'appliance_description', type: 'text', label: 'Appliance Description', required: true },
      { id: 'make_model', type: 'text', label: 'Make/Model', required: true },
      { id: 'serial_number', type: 'text', label: 'Serial Number', required: false },
      { id: 'appliance_location', type: 'text', label: 'Location', required: true },
      {
        id: 'test_results_section',
        type: 'section',
        label: 'TEST RESULTS'
      },
      {
        id: 'visual_inspection',
        type: 'select',
        label: 'Visual Inspection',
        options: ['Pass', 'Fail'],
        required: true
      },
      {
        id: 'earth_continuity',
        type: 'select',
        label: 'Earth Continuity Test',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'insulation_resistance',
        type: 'select',
        label: 'Insulation Resistance Test',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'tag_section',
        type: 'section',
        label: 'TAG DETAILS'
      },
      {
        id: 'tag_color',
        type: 'select',
        label: 'Tag Colour',
        options: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet', 'Grey', 'White'],
        required: true
      },
      { id: 'tag_number', type: 'text', label: 'Tag Number', required: true },
      {
        id: 'result_section',
        type: 'section',
        label: 'OVERALL RESULT'
      },
      {
        id: 'overall_result',
        type: 'select',
        label: 'Overall Result',
        options: ['Pass', 'Fail'],
        required: true
      },
      { id: 'notes', type: 'textarea', label: 'Notes', required: false },
      { id: 'technician_acknowledgement', type: 'checkbox', label: 'I certify that this appliance has been tested in accordance with AS/NZS 3760:2022', required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  },

  gas_compliance: {
    name: 'Gas Compliance Certificate',
    description: 'Gas installation compliance certificate for Australian regulations. Required after gas fitting work.',
    formType: 'compliance',
    requiresSignature: true,
    fields: [
      {
        id: 'business_section',
        type: 'section',
        label: 'BUSINESS DETAILS'
      },
      { id: 'business_name', type: 'text', label: 'Business Name', required: true },
      { id: 'gasfitter_name', type: 'text', label: 'Gasfitter Name', required: true },
      { id: 'licence_number', type: 'text', label: 'Gasfitter Licence Number', required: true },
      {
        id: 'job_section',
        type: 'section',
        label: 'JOB DETAILS'
      },
      { id: 'job_address', type: 'text', label: 'Job Address', required: true },
      { id: 'date_of_work', type: 'date', label: 'Date of Work', required: true },
      {
        id: 'work_type_section',
        type: 'section',
        label: 'TYPE OF WORK PERFORMED'
      },
      {
        id: 'work_type',
        type: 'checklist',
        label: 'Work Performed',
        options: [
          'New installation',
          'Repair',
          'Modification',
          'Replacement',
          'Disconnection',
          'Reconnection',
          'Service/maintenance',
          'Appliance commissioning'
        ],
        required: true
      },
      {
        id: 'appliance_section',
        type: 'section',
        label: 'APPLIANCE DETAILS'
      },
      { id: 'appliance_type', type: 'text', label: 'Appliance Type', required: true },
      { id: 'appliance_make', type: 'text', label: 'Make', required: true },
      { id: 'appliance_model', type: 'text', label: 'Model', required: true },
      { id: 'appliance_serial', type: 'text', label: 'Serial Number', required: false },
      {
        id: 'safety_checks_section',
        type: 'section',
        label: 'SAFETY CHECKS'
      },
      {
        id: 'gas_leak_test',
        type: 'select',
        label: 'Gas Leak Test',
        options: ['Pass', 'Fail'],
        required: true
      },
      {
        id: 'ventilation_check',
        type: 'select',
        label: 'Ventilation Check',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'flame_safeguards',
        type: 'select',
        label: 'Flame Safeguards Operational',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'pressure_test',
        type: 'select',
        label: 'Pressure Test',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'meter_section',
        type: 'section',
        label: 'METER DETAILS (IF APPLICABLE)'
      },
      { id: 'meter_number', type: 'text', label: 'Meter Number', required: false },
      { id: 'meter_location', type: 'text', label: 'Meter Location', required: false },
      {
        id: 'compliance_section',
        type: 'section',
        label: 'COMPLIANCE STATEMENT'
      },
      { id: 'additional_notes', type: 'textarea', label: 'Additional Notes', required: false },
      { id: 'compliance_declaration', type: 'checkbox', label: 'I certify that all gas work has been completed in accordance with AS/NZS 5601 and relevant state/territory regulations', required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  },

  plumbing_compliance: {
    name: 'Plumbing Compliance Certificate',
    description: 'Plumbing work compliance certificate as required by Australian plumbing regulations.',
    formType: 'compliance',
    requiresSignature: true,
    fields: [
      {
        id: 'business_section',
        type: 'section',
        label: 'BUSINESS DETAILS'
      },
      { id: 'business_name', type: 'text', label: 'Business Name', required: true },
      { id: 'plumber_name', type: 'text', label: 'Plumber Name', required: true },
      { id: 'licence_number', type: 'text', label: 'Plumbing Licence Number', required: true },
      {
        id: 'job_section',
        type: 'section',
        label: 'JOB DETAILS'
      },
      { id: 'site_address', type: 'text', label: 'Site Address', required: true },
      { id: 'date_of_work', type: 'date', label: 'Date of Work', required: true },
      {
        id: 'work_type_section',
        type: 'section',
        label: 'WORK PERFORMED'
      },
      {
        id: 'work_type',
        type: 'checklist',
        label: 'Type of Work',
        options: [
          'New installation',
          'Repair',
          'Drainage work',
          'Hot water system',
          'Cold water supply',
          'Gas fitting',
          'Sanitary fixtures',
          'Stormwater drainage',
          'Backflow prevention',
          'Rainwater tank connection'
        ],
        required: true
      },
      {
        id: 'test_results_section',
        type: 'section',
        label: 'TEST RESULTS'
      },
      {
        id: 'pressure_test',
        type: 'select',
        label: 'Pressure Test',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'drainage_test',
        type: 'select',
        label: 'Drainage Test',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'water_supply_test',
        type: 'select',
        label: 'Water Supply Test',
        options: ['Pass', 'Fail', 'N/A'],
        required: true
      },
      {
        id: 'materials_section',
        type: 'section',
        label: 'MATERIALS USED'
      },
      { id: 'materials_description', type: 'textarea', label: 'Materials Used', placeholder: 'List materials used (must be compliant with Australian Standards)', required: true },
      { id: 'materials_compliant', type: 'checkbox', label: 'All materials used are compliant with relevant Australian Standards (AS/NZS)', required: true },
      {
        id: 'compliance_section',
        type: 'section',
        label: 'COMPLIANCE DECLARATION'
      },
      { id: 'additional_notes', type: 'textarea', label: 'Additional Notes', required: false },
      { id: 'compliance_declaration', type: 'checkbox', label: 'I certify that all plumbing work has been completed in accordance with the Plumbing Code of Australia and relevant state/territory regulations', required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true,
      notifyOwner: true
    }
  }
};

export type SafetyFormTemplateKey = keyof typeof SAFETY_FORM_TEMPLATES;

export function getSafetyFormTemplates() {
  return Object.entries(SAFETY_FORM_TEMPLATES).map(([key, template]) => ({
    templateKey: key,
    ...template,
    isSystemTemplate: true
  }));
}

export function getSafetyFormTemplate(key: SafetyFormTemplateKey) {
  const template = SAFETY_FORM_TEMPLATES[key];
  if (!template) return null;
  return {
    templateKey: key,
    ...template,
    isSystemTemplate: true
  };
}
