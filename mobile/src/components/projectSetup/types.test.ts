import {
  DEFAULT_FINANCIAL_SETTINGS,
  type ProjectSetupData,
  validateProjectSetup,
} from './types';

function setupWithPhaseBudget(budgetedCost: string): ProjectSetupData {
  return {
    phases: [{
      clientId: 'phase-1',
      phaseCode: 'P01',
      name: 'Planning',
      description: '',
      scheduledStart: '',
      scheduledEnd: '',
      budgetedCost,
      assignedUserId: null,
      sortOrder: 0,
    }],
    purchaseOrders: [],
    claimStages: [],
    checklistItems: [],
    requiredInformation: [],
    documents: [],
    financialSettings: { ...DEFAULT_FINANCIAL_SETTINGS },
  };
}

describe('validateProjectSetup phase budgets', () => {
  it.each(['', '0', '1000', '1000.5', '1000.50'])(
    'accepts a server-compatible budget value: %s',
    (budgetedCost) => {
      expect(validateProjectSetup(setupWithPhaseBudget(budgetedCost))).toBeNull();
    },
  );

  it.each(['-1', '+1', '1.234', '1e3', 'NaN'])(
    'rejects a budget the server cannot store: %s',
    (budgetedCost) => {
      expect(validateProjectSetup(setupWithPhaseBudget(budgetedCost))).toContain(
        'up to 2 decimal places',
      );
    },
  );
});