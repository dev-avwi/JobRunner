import { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { captureException } from '../lib/sentry';
import { colors as staticColors } from '../lib/colors';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

function getDeviceInfo(): string {
  const lines = [
    `Platform: ${Platform.OS} ${Platform.Version}`,
    `Device: ${Platform.OS === 'ios' ? 'iOS Device' : 'Android Device'}`,
    `App Version: ${Constants.expoConfig?.version ?? 'unknown'}`,
    `Build: ${Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 'unknown'}`,
    `Expo SDK: ${Constants.expoConfig?.sdkVersion ?? 'unknown'}`,
  ];
  return lines.join('\n');
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    captureException(error, { componentStack: errorInfo.componentStack });
    if (__DEV__) console.error('[ErrorBoundary] Caught error:', error.message);
    if (__DEV__) console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const deviceInfo = getDeviceInfo();

      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>!</Text>
            </View>

            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              The app ran into an unexpected error. You can restart to try again.
            </Text>

            <TouchableOpacity style={styles.restartButton} onPress={this.handleRestart}>
              <Text style={styles.restartButtonText}>Restart App</Text>
            </TouchableOpacity>

            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug Info</Text>
              <View style={styles.debugBox}>
                <Text style={styles.debugText} selectable>{deviceInfo}</Text>
                {error && (
                  <>
                    <Text style={styles.debugLabel}>Error:</Text>
                    <Text style={styles.debugText} selectable>{error.message}</Text>
                  </>
                )}
                {errorInfo?.componentStack && (
                  <>
                    <Text style={styles.debugLabel}>Component Stack:</Text>
                    <Text style={styles.debugTextSmall} selectable>
                      {errorInfo.componentStack.substring(0, 500)}
                    </Text>
                  </>
                )}
              </View>
              <Text style={styles.debugHint}>
                Long press the text above to copy and include in a support request.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#dc2626',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  restartButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 32,
  },
  restartButtonText: {
    color: staticColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  debugSection: {
    width: '100%',
    maxWidth: 400,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  debugBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 10,
    marginBottom: 2,
  },
  debugText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugTextSmall: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ErrorBoundary;
