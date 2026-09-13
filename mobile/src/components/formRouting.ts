/**
 * Form-type routing constants and predicates shared between FormRenderer and
 * its tests. Kept in a dependency-free module so unit tests can import the
 * real production logic without pulling in React Native or Expo.
 */

export interface RoutableForm {
  formType?: string;
}

/** Form types that belong on the Overview tab (safety induction area). */
export const SAFETY_FORM_TYPES = ['safety', 'inspection', 'compliance'];

/**
 * Returns true when the form is a safety/inspection/compliance type and
 * should appear on the Overview tab rather than the Files tab.
 */
export const isSafetyTypeForm = (f: RoutableForm): boolean =>
  SAFETY_FORM_TYPES.includes(String(f.formType || '').toLowerCase());

/**
 * Returns true when the form should be shown under the given tab filter.
 *
 * - filter='safety' → Overview tab: only safety/inspection/compliance forms
 * - filter='other'  → Files tab: all non-safety forms (including untyped)
 * - filter=undefined → no filtering; all forms pass
 *
 * This is the exact predicate consumed by JobForms when computing
 * displayForms and displaySubmissions.
 */
export const matchesFormFilter = (
  f: RoutableForm,
  filter: 'safety' | 'other' | undefined,
): boolean => {
  if (filter === 'safety') return isSafetyTypeForm(f);
  if (filter === 'other') return !isSafetyTypeForm(f);
  return true;
};
