jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0' },
  },
}));

jest.mock('expo-store-review', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  hasAction: jest.fn(),
  requestReview: jest.fn(),
}));
