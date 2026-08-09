import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Modal,
} from 'react-native';
import { PressableRow } from './ui/PressableRow';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography, iconSizes } from '../lib/design-tokens';
import { api } from '../lib/api';
import haptics from '../lib/haptics';
import debounce from 'lodash/debounce';

interface SearchResult {
  id: string;
  type: 'job' | 'client' | 'quote' | 'invoice' | 'receipt';
  title: string;
  subtitle?: string;
  status?: string;
}

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

const getTypeConfig = (type: string) => {
  switch (type) {
    case 'job':
      return { icon: 'briefcase' as const, color: '#3b82f6', label: 'Job' };
    case 'client':
      return { icon: 'user' as const, color: '#8b5cf6', label: 'Client' };
    case 'quote':
      return { icon: 'file-text' as const, color: '#f59e0b', label: 'Quote' };
    case 'invoice':
      return { icon: 'file' as const, color: '#10b981', label: 'Invoice' };
    case 'receipt':
      return { icon: 'check-circle' as const, color: '#22c55e', label: 'Receipt' };
    default:
      return { icon: 'search' as const, color: '#6b7280', label: type };
  }
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    marginTop: 60,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  resultIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.foreground,
  },
  resultSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  resultMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  typeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  recentSearches: {
    padding: spacing.md,
  },
  recentTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  recentText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
});

export function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const [jobsRes, clientsRes, quotesRes, invoicesRes] = await Promise.all([
        api.get<any[]>('/api/jobs'),
        api.get<any[]>('/api/clients'),
        api.get<any[]>('/api/quotes'),
        api.get<any[]>('/api/invoices'),
      ]);
      
      const allResults: SearchResult[] = [];
      const lowerQuery = searchQuery.toLowerCase();
      
      (jobsRes.data || []).forEach(job => {
        if (
          job.title?.toLowerCase().includes(lowerQuery) ||
          job.address?.toLowerCase().includes(lowerQuery) ||
          job.description?.toLowerCase().includes(lowerQuery)
        ) {
          allResults.push({
            id: job.id,
            type: 'job',
            title: job.title,
            subtitle: job.address,
            status: job.status,
          });
        }
      });
      
      (clientsRes.data || []).forEach(client => {
        if (
          client.name?.toLowerCase().includes(lowerQuery) ||
          client.email?.toLowerCase().includes(lowerQuery) ||
          client.phone?.includes(lowerQuery)
        ) {
          allResults.push({
            id: client.id,
            type: 'client',
            title: client.name,
            subtitle: client.email || client.phone,
          });
        }
      });
      
      (quotesRes.data || []).forEach(quote => {
        if (
          quote.title?.toLowerCase().includes(lowerQuery) ||
          quote.number?.toLowerCase().includes(lowerQuery)
        ) {
          allResults.push({
            id: quote.id,
            type: 'quote',
            title: quote.title || `Quote ${quote.number}`,
            subtitle: quote.number,
            status: quote.status,
          });
        }
      });
      
      (invoicesRes.data || []).forEach(invoice => {
        if (
          invoice.title?.toLowerCase().includes(lowerQuery) ||
          invoice.number?.toLowerCase().includes(lowerQuery)
        ) {
          allResults.push({
            id: invoice.id,
            type: 'invoice',
            title: invoice.title || `Invoice ${invoice.number}`,
            subtitle: invoice.number,
            status: invoice.status,
          });
        }
      });
      
      setResults(allResults.slice(0, 20));
    } catch (error) {
      if (__DEV__) console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );
  
  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query, debouncedSearch]);
  
  const handleResultPress = (result: SearchResult) => {
    haptics.selection();
    Keyboard.dismiss();
    onClose();
    
    switch (result.type) {
      case 'job':
        router.push(`/job/${result.id}`);
        break;
      case 'client':
        router.push(`/more/client/${result.id}`);
        break;
      case 'quote':
        router.push(`/more/quote/${result.id}`);
        break;
      case 'invoice':
        router.push(`/more/invoice/${result.id}`);
        break;
      case 'receipt':
        router.push(`/more/receipt/${result.id}`);
        break;
    }
  };
  
  const renderResult = ({ item }: { item: SearchResult }) => {
    const config = getTypeConfig(item.type);
    
    return (
      <PressableRow style={styles.resultItem} onPress={() => handleResultPress(item)} >
        <View style={[styles.resultIconContainer, { backgroundColor: config.color + '20' }]}>
          <Feather name={config.icon} size={iconSizes.md} color={config.color} />
        </View>
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          )}
        </View>
        <View style={styles.resultMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{config.label}</Text>
          </View>
          {item.status && (
            <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
              <Text style={[styles.statusText, { color: config.color }]}>
                {item.status}
              </Text>
            </View>
          )}
        </View>
      </PressableRow>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={iconSizes.sm} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search jobs, clients, documents..."
                placeholderTextColor={colors.mutedForeground}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <PressableRow onPress={() => setQuery('')}>
                  <Feather name="x" size={iconSizes.sm} color={colors.mutedForeground} />
                </PressableRow>
              )}
            </View>
            <PressableRow style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Cancel</Text>
            </PressableRow>
          </View>
          
          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : hasSearched && results.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Feather name="search" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>
                  Try searching with different keywords
                </Text>
              </View>
            ) : results.length > 0 ? (
              <FlatList
                data={results}
                renderItem={renderResult}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <View style={styles.recentSearches}>
                <Text style={styles.recentTitle}>Quick Tips</Text>
                <View style={styles.recentItem}>
                  <Feather name="info" size={iconSizes.sm} color={colors.mutedForeground} />
                  <Text style={styles.recentText}>Search by job title, client name, or document number</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default GlobalSearch;
