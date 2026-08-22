import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

const mockPut = jest.fn();
const mockShowToast = jest.fn();

jest.mock('../../../lib/api', () => ({
  api: {
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

jest.mock('../../../lib/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('../../ui/AppBottomSheet', () => ({
  __esModule: true,
  default: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="expense-edit-sheet">{children}{footer}</View>;
  },
}));

jest.mock('../../ui/PressableRow', () => ({
  __esModule: true,
  default: ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    testID?: string;
  }) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity testID={testID} onPress={onPress}>{children}</TouchableOpacity>;
  },
}));

import ExpensesSection, {
  type PhaseStub,
  type SectionExpense,
} from '../ExpensesSection';

const COLORS = {
  background: '#ffffff',
  card: '#ffffff',
  cardBorder: '#d1d5db',
  border: '#d1d5db',
  destructive: '#dc2626',
  foreground: '#111827',
  muted: '#f3f4f6',
  mutedForeground: '#6b7280',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  primaryLight: '#dbeafe',
} as any;

const PHASE: PhaseStub = {
  id: 'phase-1',
  name: 'Groundworks',
  phaseCode: '01',
  status: 'in_progress',
  sortOrder: 1,
};

const EXPENSE: SectionExpense = {
  id: 'expense-1',
  categoryId: 'materials',
  amount: '125.00',
  description: 'Concrete delivery',
  expenseDate: '2026-08-22',
  isBillable: true,
  phaseId: null,
};

function findByTestID(tree: ReactTestRenderer, testID: string): ReactTestInstance[] {
  return tree.root.findAll((node: ReactTestInstance) => node.props?.testID === testID);
}

function firstByTestID(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  const match = findByTestID(tree, testID)[0];
  if (!match) throw new Error(`Missing testID: ${testID}`);
  return match;
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  await act(async () => {
    firstByTestID(tree, testID).props.onPress();
    await Promise.resolve();
  });
}

async function renderExpenses(expense: SectionExpense = EXPENSE): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ExpensesSection
        colors={COLORS}
        expenses={[expense]}
        isLoading={false}
        jobId="job-1"
        isOwnerOrManager
        phases={[PHASE]}
      />,
    );
  });
  return tree;
}

describe('ExpensesSection phase reassignment', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockShowToast.mockReset();
    mockPut.mockResolvedValue({ data: { success: true } });
  });

  it('moves an expense from Unassigned to a phase and back to Unassigned', async () => {
    const tree = await renderExpenses();

    await press(tree, 'expense-row-expense-1');
    await press(tree, 'expense-phase-option-phase-1');
    await press(tree, 'expense-edit-save');

    expect(mockPut).toHaveBeenNthCalledWith(1, '/api/expenses/expense-1', {
      phaseId: 'phase-1',
    });

    // Refresh the row with the saved phase, as the screen does after onRefresh.
    await act(async () => {
      tree.update(
        <ExpensesSection
          colors={COLORS}
          expenses={[{ ...EXPENSE, phaseId: 'phase-1' }]}
          isLoading={false}
          jobId="job-1"
          isOwnerOrManager
          phases={[PHASE]}
        />,
      );
    });

    await press(tree, 'expense-row-expense-1');
    await press(tree, 'expense-phase-option-unassigned');
    await press(tree, 'expense-edit-save');

    expect(mockPut).toHaveBeenNthCalledWith(2, '/api/expenses/expense-1', {
      phaseId: null,
    });
    expect(mockPut).toHaveBeenCalledTimes(2);
  });
});