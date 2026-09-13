/**
 * Tests for JobForms form-type filter routing (Overview vs Files split).
 *
 * Imports SAFETY_FORM_TYPES, isSafetyTypeForm, and matchesFormFilter directly
 * from the production formRouting module consumed by FormRenderer. Any change
 * to the constants, predicate, or filter branching in production immediately
 * breaks the relevant assertions here.
 *
 * Covers:
 * - Safety/inspection/compliance forms pass filter="safety" (Overview tab)
 * - General/untyped forms pass filter="other" (Files tab), not Overview
 * - Forms with no formType land on Files (not Overview)
 * - All SAFETY_FORM_TYPES variants are recognised (case-insensitive)
 * - No filter active: every form passes
 * - Mutual exclusivity: every form lands in exactly one of the two tabs
 */

import { SAFETY_FORM_TYPES, isSafetyTypeForm, matchesFormFilter, RoutableForm } from '../formRouting';

// ─── Fixture forms ─────────────────────────────────────────────────────────────

const makeForm = (id: string, formType?: string): RoutableForm & { id: string } => ({
  id,
  formType,
});

const safetyForm     = makeForm('f-safety',     'safety');
const inspectionForm = makeForm('f-inspection', 'inspection');
const complianceForm = makeForm('f-compliance', 'compliance');
const generalForm    = makeForm('f-general',    'general');
const untypedForm    = makeForm('f-untyped',    undefined);
const emptyTypeForm  = makeForm('f-empty',      '');

const ALL_FORMS = [safetyForm, inspectionForm, complianceForm, generalForm, untypedForm, emptyTypeForm];

// ─── 1. SAFETY_FORM_TYPES constant ────────────────────────────────────────────

describe('SAFETY_FORM_TYPES (production constant)', () => {
  it('contains "safety"', () => {
    expect(SAFETY_FORM_TYPES).toContain('safety');
  });

  it('contains "inspection"', () => {
    expect(SAFETY_FORM_TYPES).toContain('inspection');
  });

  it('contains "compliance"', () => {
    expect(SAFETY_FORM_TYPES).toContain('compliance');
  });
});

// ─── 2. isSafetyTypeForm predicate (production) ───────────────────────────────

describe('isSafetyTypeForm (production predicate)', () => {
  it('returns true for formType="safety"', () => {
    expect(isSafetyTypeForm(safetyForm)).toBe(true);
  });

  it('returns true for formType="inspection"', () => {
    expect(isSafetyTypeForm(inspectionForm)).toBe(true);
  });

  it('returns true for formType="compliance"', () => {
    expect(isSafetyTypeForm(complianceForm)).toBe(true);
  });

  it('is case-insensitive (Safety, INSPECTION, Compliance)', () => {
    expect(isSafetyTypeForm(makeForm('x', 'Safety'))).toBe(true);
    expect(isSafetyTypeForm(makeForm('x', 'INSPECTION'))).toBe(true);
    expect(isSafetyTypeForm(makeForm('x', 'Compliance'))).toBe(true);
  });

  it('returns false for formType="general"', () => {
    expect(isSafetyTypeForm(generalForm)).toBe(false);
  });

  it('returns false when formType is undefined', () => {
    expect(isSafetyTypeForm(untypedForm)).toBe(false);
  });

  it('returns false when formType is empty string', () => {
    expect(isSafetyTypeForm(emptyTypeForm)).toBe(false);
  });
});

// ─── 3. matchesFormFilter — filter="safety" (Overview tab) ───────────────────

describe('matchesFormFilter with filter="safety" (Overview tab)', () => {
  it('includes a safety form', () => {
    expect(matchesFormFilter(safetyForm, 'safety')).toBe(true);
  });

  it('includes an inspection form', () => {
    expect(matchesFormFilter(inspectionForm, 'safety')).toBe(true);
  });

  it('includes a compliance form', () => {
    expect(matchesFormFilter(complianceForm, 'safety')).toBe(true);
  });

  it('excludes a general form', () => {
    expect(matchesFormFilter(generalForm, 'safety')).toBe(false);
  });

  it('excludes a form with no formType', () => {
    expect(matchesFormFilter(untypedForm, 'safety')).toBe(false);
  });

  it('excludes a form with empty formType', () => {
    expect(matchesFormFilter(emptyTypeForm, 'safety')).toBe(false);
  });

  it('keeps only safety-type forms when filtering a mixed list', () => {
    const shown = ALL_FORMS.filter(f => matchesFormFilter(f, 'safety'));
    expect(shown.map(f => f.id)).toEqual(['f-safety', 'f-inspection', 'f-compliance']);
  });
});

// ─── 4. matchesFormFilter — filter="other" (Files tab) ───────────────────────

describe('matchesFormFilter with filter="other" (Files tab)', () => {
  it('excludes a safety form', () => {
    expect(matchesFormFilter(safetyForm, 'other')).toBe(false);
  });

  it('excludes an inspection form', () => {
    expect(matchesFormFilter(inspectionForm, 'other')).toBe(false);
  });

  it('excludes a compliance form', () => {
    expect(matchesFormFilter(complianceForm, 'other')).toBe(false);
  });

  it('includes a general form', () => {
    expect(matchesFormFilter(generalForm, 'other')).toBe(true);
  });

  it('includes a form with no formType', () => {
    expect(matchesFormFilter(untypedForm, 'other')).toBe(true);
  });

  it('includes a form with empty formType', () => {
    expect(matchesFormFilter(emptyTypeForm, 'other')).toBe(true);
  });

  it('keeps only non-safety forms when filtering a mixed list', () => {
    const shown = ALL_FORMS.filter(f => matchesFormFilter(f, 'other'));
    expect(shown.map(f => f.id)).toEqual(['f-general', 'f-untyped', 'f-empty']);
  });
});

// ─── 5. matchesFormFilter — no filter (undefined) ────────────────────────────

describe('matchesFormFilter with no filter (undefined)', () => {
  it('every form passes when filter is undefined', () => {
    const shown = ALL_FORMS.filter(f => matchesFormFilter(f, undefined));
    expect(shown).toHaveLength(ALL_FORMS.length);
  });
});

// ─── 6. Mutual exclusivity: Overview and Files never overlap ──────────────────

describe('mutual exclusivity between Overview and Files routing', () => {
  it('each form appears in exactly one tab', () => {
    for (const form of ALL_FORMS) {
      const inOverview = matchesFormFilter(form, 'safety');
      const inFiles    = matchesFormFilter(form, 'other');
      expect(inOverview && inFiles).toBe(false); // never in both
      expect(inOverview || inFiles).toBe(true);  // always in one
    }
  });

  it('Overview + Files accounts for every form with no gaps', () => {
    const overview = ALL_FORMS.filter(f => matchesFormFilter(f, 'safety'));
    const files    = ALL_FORMS.filter(f => matchesFormFilter(f, 'other'));
    expect(overview.length + files.length).toBe(ALL_FORMS.length);
  });
});
