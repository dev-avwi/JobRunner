import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Skeleton } from '../../src/components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { typography, fontWeights, spacing } from '../../src/lib/design-tokens';

interface AdminStats {
  kpis: {
    totalUsers: number;
    activeUsers: number;
    onboardingCompletionRate: number;
  };
  growthData: Array<{ month: string; signups: number }>;
  featureUsage: {
    totalJobs: number;
    totalInvoices: number;
    totalQuotes: number;
    totalClients: number;
    completedJobs: number;
    paidInvoices: number;
    acceptedQuotes: number;
  };
  tierBreakdown: {
    free: number;
    pro: number;
    trial: number;
  };
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  subscriptionTier: string | null;
  tradeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isActive: boolean | null;
  emailVerified: boolean | null;
  hasCompletedOnboarding: boolean;
  businessName: string | null;
}

interface SystemHealth {
  api: { status: string; latency: number };
  database: { status: string; latency: number };
  backgroundJobs: { status: string; pending: number };
  storage: { status: string; used: string };
}

interface Activity {
  id: string;
  type: 'signup' | 'onboarding' | 'upgrade';
  user: string;
  email: string;
  timestamp: string;
  details?: string;
}

type TabType = 'overview' | 'users' | 'health' | 'activity';

const tabs: { id: TabType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'health', label: 'Health', icon: 'heart' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
];

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch {
    return 'Never';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch {
    return '-';
  }
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get<AdminStats>('/api/admin/stats'),
        api.get<{ users: AdminUser[] }>('/api/admin/users'),
      ]);
      
      if (statsRes.data) setStats(statsRes.data);
      if (usersRes.data?.users) setUsers(usersRes.data.users);
    } catch (error: any) {
      if (__DEV__) console.log('Admin data fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHealthData = useCallback(async () => {
    setHealthLoading(true);
    try {
      const healthRes = await api.get<SystemHealth>('/api/admin/health');
      if (healthRes.data) {
        setHealth(healthRes.data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
    fetchHealthData();
  }, [fetchAdminData, fetchHealthData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAdminData(), fetchHealthData()]);
    setRefreshing(false);
  }, [fetchAdminData, fetchHealthData]);

  const recentActivity = useMemo((): Activity[] => {
    if (!users.length) return [];
    
    const activities: Activity[] = [];
    
    users.forEach((u) => {
      if (u.createdAt) {
        activities.push({
          id: `signup-${u.id}`,
          type: 'signup',
          user: u.name || 'Unknown User',
          email: u.email || '',
          timestamp: u.createdAt,
          details: u.businessName || undefined,
        });
      }
      
      if (u.hasCompletedOnboarding && u.updatedAt && u.updatedAt !== u.createdAt) {
        activities.push({
          id: `onboarding-${u.id}`,
          type: 'onboarding',
          user: u.name || 'Unknown User',
          email: u.email || '',
          timestamp: u.updatedAt,
        });
      }
      
      if (u.subscriptionTier === 'pro' && u.updatedAt) {
        activities.push({
          id: `upgrade-${u.id}`,
          type: 'upgrade',
          user: u.name || 'Unknown User',
          email: u.email || '',
          timestamp: u.updatedAt,
        });
      }
    });
    
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 50);
  }, [users]);

  if (!user?.isPlatformAdmin) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.accessDenied}>
            <View style={[styles.accessDeniedIcon, { backgroundColor: colors.destructiveLight }]}>
              <Feather name="shield-off" size={32} color={colors.destructive} />
            </View>
            <Text style={[styles.accessDeniedTitle, { color: colors.foreground }]}>
              Access Denied
            </Text>
            <Text style={[styles.accessDeniedText, { color: colors.mutedForeground }]}>
              You don't have permission to access the admin dashboard.
            </Text>
            <PressableRow style={[styles.accessDeniedButton, { backgroundColor: colors.primary }]} onPress={() => router.back()} >
              <Text style={[styles.accessDeniedButtonText, { color: colors.primaryForeground }]}>
                Go Back
              </Text>
            </PressableRow>
          </View>
        </View>
      </>
    );
  }

  const getActivityConfig = (type: Activity['type']) => {
    switch (type) {
      case 'signup':
        return {
          icon: 'user-plus' as const,
          label: 'New signup',
          bgColor: colors.infoLight,
          iconColor: colors.info,
        };
      case 'onboarding':
        return {
          icon: 'check-circle' as const,
          label: 'Completed onboarding',
          bgColor: colors.successLight,
          iconColor: colors.success,
        };
      case 'upgrade':
        return {
          icon: 'trending-up' as const,
          label: 'Upgraded to Pro',
          bgColor: colors.warningLight,
          iconColor: colors.warning,
        };
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return colors.success;
      case 'degraded': return colors.warning;
      case 'down': return colors.destructive;
      default: return colors.mutedForeground;
    }
  };

  const getHealthBgColor = (status: string) => {
    switch (status) {
      case 'healthy': return colors.successLight;
      case 'degraded': return colors.warningLight;
      case 'down': return colors.destructiveLight;
      default: return colors.muted;
    }
  };

  const getTierBadgeVariant = (tier: string | null): 'default' | 'secondary' | 'outline' | 'success' | 'warning' => {
    const t = tier?.toLowerCase() || 'free';
    if (t === 'pro' || t === 'team') return 'success';
    if (t === 'trial') return 'warning';
    return 'outline';
  };

  const renderSkeletonKPI = () => (
    <View style={styles.kpiGrid}>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} style={styles.kpiCard}>
          <CardContent style={styles.kpiCardContent}>
            <View style={{ flex: 1 }}>
              <Skeleton width={60} height={12} />
              <Skeleton width={50} height={28} style={{ marginTop: spacing.sm }} />
            </View>
            <Skeleton width={44} height={44} borderRadius={12} />
          </CardContent>
        </Card>
      ))}
    </View>
  );

  const renderOverview = () => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Platform KPIs</Text>
      {loading ? renderSkeletonKPI() : (
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <CardContent style={styles.kpiCardContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Total Users</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {stats?.kpis.totalUsers || 0}
                </Text>
              </View>
              <View style={[styles.kpiIconBg, { backgroundColor: colors.infoLight }]}>
                <Feather name="users" size={22} color={colors.info} />
              </View>
            </CardContent>
          </Card>
          
          <Card style={styles.kpiCard}>
            <CardContent style={styles.kpiCardContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Active (7d)</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {stats?.kpis.activeUsers || 0}
                </Text>
              </View>
              <View style={[styles.kpiIconBg, { backgroundColor: colors.successLight }]}>
                <Feather name="user-check" size={22} color={colors.success} />
              </View>
            </CardContent>
          </Card>
          
          <Card style={styles.kpiCard}>
            <CardContent style={styles.kpiCardContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Onboarding</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {stats?.kpis.onboardingCompletionRate || 0}%
                </Text>
              </View>
              <View style={[styles.kpiIconBg, { backgroundColor: isDark ? '#2a1f4d' : '#ede9fe' }]}>
                <Feather name="check-circle" size={22} color={isDark ? '#9b5dff' : '#7c3aed'} />
              </View>
            </CardContent>
          </Card>
          
          <Card style={styles.kpiCard}>
            <CardContent style={styles.kpiCardContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Pro Users</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {stats?.tierBreakdown?.pro || 0}
                </Text>
              </View>
              <View style={[styles.kpiIconBg, { backgroundColor: colors.warningLight }]}>
                <Feather name="trending-up" size={22} color={colors.warning} />
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Feature Usage</Text>
      <Card>
        <CardContent style={{ paddingVertical: spacing.sm }}>
          {loading ? (
            <View style={{ gap: spacing.md }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Skeleton width={20} height={20} borderRadius={4} />
                    <Skeleton width={80} height={14} />
                  </View>
                  <Skeleton width={40} height={18} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {[
                { icon: 'briefcase' as const, label: 'Total Jobs', value: stats?.featureUsage?.totalJobs || 0 },
                { icon: 'check-circle' as const, label: 'Completed Jobs', value: stats?.featureUsage?.completedJobs || 0, color: colors.success },
                { icon: 'file-text' as const, label: 'Total Invoices', value: stats?.featureUsage?.totalInvoices || 0 },
                { icon: 'check-circle' as const, label: 'Paid Invoices', value: stats?.featureUsage?.paidInvoices || 0, color: colors.success },
                { icon: 'clipboard' as const, label: 'Total Quotes', value: stats?.featureUsage?.totalQuotes || 0 },
                { icon: 'users' as const, label: 'Total Clients', value: stats?.featureUsage?.totalClients || 0 },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureRow, idx !== 5 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Feather name={item.icon} size={18} color={item.color || colors.mutedForeground} />
                    <Text style={[styles.featureLabel, { color: colors.foreground }]}>{item.label}</Text>
                  </View>
                  <Text style={[styles.featureValue, { color: colors.foreground }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Subscription Breakdown</Text>
      <View style={styles.subscriptionGrid}>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.subscriptionCard}>
            <Text style={[styles.subscriptionValue, { color: colors.foreground }]}>
              {stats?.tierBreakdown?.free || 0}
            </Text>
            <Text style={[styles.subscriptionLabel, { color: colors.mutedForeground }]}>Free</Text>
          </CardContent>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.subscriptionCard}>
            <Text style={[styles.subscriptionValue, { color: colors.foreground }]}>
              {stats?.tierBreakdown?.trial || 0}
            </Text>
            <Text style={[styles.subscriptionLabel, { color: colors.mutedForeground }]}>Trial</Text>
          </CardContent>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.subscriptionCard}>
            <Text style={[styles.subscriptionValue, { color: colors.foreground }]}>
              {stats?.tierBreakdown?.pro || 0}
            </Text>
            <Text style={[styles.subscriptionLabel, { color: colors.mutedForeground }]}>Pro</Text>
          </CardContent>
        </Card>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: spacing.lg }]}>Demo Tools</Text>
      <Card>
        <CardContent style={{ paddingVertical: spacing.md }}>
          <PressableRow style={[styles.demoToolButton, { backgroundColor: colors.primary }]} onPress={async () => { try { type DemoResp = { success?: boolean; updated?: { todaysJobs?: number; thisWeekJobs?: number; upcomingJobs?: number } }; const response = await api.post<DemoResp>('/api/admin/refresh-demo-screenshots'); if (response.data?.success) { Alert.alert( 'Demo Data Refreshed', `${response.data.updated?.todaysJobs || 0} jobs today\n${response.data.updated?.thisWeekJobs || 0} jobs this week\n${response.data.updated?.upcomingJobs || 0} upcoming jobs\n\nPull down to refresh to see updated data.` ); } else { Alert.alert('Error', 'Failed to refresh demo data'); } } catch (error: any) { Alert.alert('Error', error.response?.data?.error || 'Failed to refresh demo data'); } }} >
            <Feather name="camera" size={18} color={colors.primaryForeground} />
            <Text style={[styles.demoToolButtonText, { color: colors.primaryForeground }]}>
              Refresh for Screenshots
            </Text>
          </PressableRow>
          <Text style={[styles.demoToolHint, { color: colors.mutedForeground }]}>
            Updates jobs to today/this week and refreshes activity logs for App Store screenshots.
          </Text>
        </CardContent>
      </Card>
    </>
  );

  const renderUsers = () => (
    <>
      <View style={styles.usersSectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 0 }]}>
          All Users
        </Text>
        <Badge variant="secondary">
          <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.foreground }}>{users.length}</Text>
        </Badge>
      </View>
      
      {loading ? (
        <View style={{ gap: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, gap: spacing.sm }}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="80%" height={14} />
                    <Skeleton width="40%" height={12} />
                  </View>
                  <Skeleton width={50} height={22} borderRadius={4} />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg }}>
                  <Skeleton width={80} height={14} />
                  <Skeleton width={80} height={14} />
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : users.length === 0 ? (
        <Card>
          <CardContent style={styles.emptyState}>
            <Feather name="users" size={48} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No users found</Text>
          </CardContent>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent>
                <View style={styles.userHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.foreground }]}>
                      {u.name || 'Unnamed User'}
                    </Text>
                    <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
                      {u.email || 'No email'}
                    </Text>
                    {u.businessName && (
                      <Text style={[styles.userBusiness, { color: colors.secondaryText }]}>
                        {u.businessName}
                      </Text>
                    )}
                  </View>
                  <Badge variant={getTierBadgeVariant(u.subscriptionTier)}>
                    <Text style={{ 
                      fontSize: typography.sizes.xs, 
                      fontWeight: fontWeights.semibold, 
                      textTransform: 'uppercase',
                      color: getTierBadgeVariant(u.subscriptionTier) === 'outline' ? colors.foreground : 
                             getTierBadgeVariant(u.subscriptionTier) === 'success' ? colors.success :
                             colors.warning
                    }}>
                      {u.subscriptionTier || 'Free'}
                    </Text>
                  </Badge>
                </View>
                
                <View style={styles.userMeta}>
                  <View style={styles.userMetaItem}>
                    <Feather 
                      name={u.emailVerified ? 'check-circle' : 'x-circle'} 
                      size={14} 
                      color={u.emailVerified ? colors.success : colors.mutedForeground} 
                    />
                    <Text style={[styles.userMetaText, { color: colors.mutedForeground }]}>
                      {u.emailVerified ? 'Verified' : 'Unverified'}
                    </Text>
                  </View>
                  <View style={styles.userMetaItem}>
                    <Feather 
                      name={u.hasCompletedOnboarding ? 'check-circle' : 'clock'} 
                      size={14} 
                      color={u.hasCompletedOnboarding ? colors.success : colors.mutedForeground} 
                    />
                    <Text style={[styles.userMetaText, { color: colors.mutedForeground }]}>
                      {u.hasCompletedOnboarding ? 'Onboarded' : 'Pending'}
                    </Text>
                  </View>
                  <View style={styles.userMetaItem}>
                    <Feather name="calendar" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.userMetaText, { color: colors.mutedForeground }]}>
                      {formatDate(u.createdAt)}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </>
  );

  const renderHealth = () => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>System Status</Text>
      
      {healthLoading ? (
        <View style={{ gap: spacing.md }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent style={styles.healthCard}>
                <Skeleton width={44} height={44} borderRadius={12} />
                <View style={{ flex: 1, marginLeft: spacing.lg, gap: 6 }}>
                  <Skeleton width="50%" height={16} />
                  <Skeleton width="70%" height={12} />
                </View>
                <Skeleton width={70} height={24} borderRadius={6} />
              </CardContent>
            </Card>
          ))}
        </View>
      ) : health === null ? (
        <Card>
          <CardContent style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={[styles.healthIconBg, { backgroundColor: '#ef444415' }]}>
                <Feather name="alert-triangle" size={22} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.healthName, { color: colors.foreground }]}>Couldn't reach health endpoint</Text>
                <Text style={[styles.healthDetail, { color: colors.mutedForeground }]}>
                  /api/admin/health did not respond. Status of services is unknown — check server logs.
                </Text>
              </View>
            </View>
            <PressableRow onPress={fetchHealthData} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, backgroundColor: colors.muted, alignSelf: 'flex-start', }} >
              <Feather name="refresh-cw" size={14} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm }}>Retry</Text>
            </PressableRow>
          </CardContent>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {[
            { key: 'api', icon: 'server' as const, name: 'API Server', data: health?.api },
            { key: 'database', icon: 'database' as const, name: 'Database', data: health?.database },
            { key: 'jobs', icon: 'zap' as const, name: 'Background Jobs', data: health?.backgroundJobs },
            { key: 'storage', icon: 'hard-drive' as const, name: 'Storage', data: health?.storage },
          ].map((item) => (
            <Card key={item.key}>
              <CardContent style={styles.healthCard}>
                <View style={[styles.healthIconBg, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon} size={22} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.healthName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.healthDetail, { color: colors.mutedForeground }]}>
                    {item.key === 'storage' 
                      ? `Used: ${(item.data as any)?.used || 'N/A'}`
                      : item.key === 'jobs'
                        ? `Pending: ${(item.data as any)?.pending ?? '—'}`
                        : (item.data as any)?.latency != null
                          ? `Latency: ${(item.data as any).latency}ms`
                          : 'Latency: —'
                    }
                  </Text>
                </View>
                <View style={[styles.healthBadge, { backgroundColor: getHealthBgColor(item.data?.status || 'unknown') }]}>
                  <View style={[styles.healthDot, { backgroundColor: getHealthColor(item.data?.status || 'unknown') }]} />
                  <Text style={[styles.healthStatus, { color: getHealthColor(item.data?.status || 'unknown') }]}>
                    {item.data?.status || 'Unknown'}
                  </Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Active Sessions</Text>
      <View style={styles.performanceGrid}>
        <View style={[styles.performanceCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.performanceLabel, { color: colors.mutedForeground }]}>Active Users</Text>
          <Text style={[styles.performanceValue, { color: colors.foreground }]}>{String(stats?.kpis.activeUsers || 0)}</Text>
        </View>
      </View>
    </>
  );

  const renderActivity = () => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Activity Metrics</Text>
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <CardContent style={styles.kpiCardContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Jobs Created</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                {stats?.featureUsage?.totalJobs || 0}
              </Text>
            </View>
            <View style={[styles.kpiIconBg, { backgroundColor: colors.infoLight }]}>
              <Feather name="briefcase" size={22} color={colors.info} />
            </View>
          </CardContent>
        </Card>
        
        <Card style={styles.kpiCard}>
          <CardContent style={styles.kpiCardContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Invoices Sent</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                {stats?.featureUsage?.totalInvoices || 0}
              </Text>
            </View>
            <View style={[styles.kpiIconBg, { backgroundColor: colors.successLight }]}>
              <Feather name="file-text" size={22} color={colors.success} />
            </View>
          </CardContent>
        </Card>
        
        <Card style={styles.kpiCard}>
          <CardContent style={styles.kpiCardContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Quotes</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                {stats?.featureUsage?.totalQuotes || 0}
              </Text>
            </View>
            <View style={[styles.kpiIconBg, { backgroundColor: isDark ? '#2a1f4d' : '#ede9fe' }]}>
              <Feather name="clipboard" size={22} color={isDark ? '#9b5dff' : '#7c3aed'} />
            </View>
          </CardContent>
        </Card>
        
        <Card style={styles.kpiCard}>
          <CardContent style={styles.kpiCardContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Clients Added</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                {stats?.featureUsage?.totalClients || 0}
              </Text>
            </View>
            <View style={[styles.kpiIconBg, { backgroundColor: colors.warningLight }]}>
              <Feather name="users" size={22} color={colors.warning} />
            </View>
          </CardContent>
        </Card>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Recent Activity</Text>
      <Card>
        <CardContent style={{ paddingVertical: 0 }}>
          {loading ? (
            <View style={{ paddingVertical: spacing.lg, gap: spacing.lg }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Skeleton width={44} height={44} borderRadius={12} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="60%" height={12} />
                  </View>
                  <Skeleton width={50} height={14} />
                </View>
              ))}
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="activity" size={48} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No recent activity</Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.mutedForeground }]}>
                Activity will appear here as users interact with the platform
              </Text>
            </View>
          ) : (
            <View style={styles.activityTimeline}>
              <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              {recentActivity.map((activity, idx) => {
                const config = getActivityConfig(activity.type);
                return (
                  <View 
                    key={activity.id} 
                    style={[
                      styles.activityItem,
                      idx !== recentActivity.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
                    ]}
                  >
                    <View style={[styles.activityIconBg, { backgroundColor: config.bgColor }]}>
                      <Feather name={config.icon} size={18} color={config.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityLabel, { color: colors.foreground }]}>{config.label}</Text>
                      <Text style={[styles.activityUser, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {activity.user}
                      </Text>
                      {activity.details && (
                        <Text style={[styles.activityDetails, { color: colors.secondaryText }]} numberOfLines={1}>
                          {activity.details}
                        </Text>
                      )}
                    </View>
                    <View style={styles.activityTime}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.activityTimeText, { color: colors.mutedForeground }]}>
                        {formatRelativeDate(activity.timestamp)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </CardContent>
      </Card>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomNavHeight }]}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="shield" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.pageTitle, { color: colors.foreground }]}>Admin Dashboard</Text>
                <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
                  Platform analytics & management
                </Text>
              </View>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabScrollView}
            contentContainerStyle={styles.tabScrollContent}
          >
            <View style={[styles.tabBar, { backgroundColor: colors.muted }]}>
              {tabs.map((tab) => (
                <PressableRow key={tab.id} style={[ styles.tab, activeTab === tab.id && { backgroundColor: colors.card }, ]} onPress={() => setActiveTab(tab.id)} >
                  <Feather 
                    name={tab.icon} 
                    size={16} 
                    color={activeTab === tab.id ? colors.primary : colors.mutedForeground} 
                  />
                  <Text 
                    style={[
                      styles.tabText, 
                      { color: activeTab === tab.id ? colors.foreground : colors.mutedForeground }
                    ]}
                  >
                    {tab.label}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </ScrollView>

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'health' && renderHealth()}
          {activeTab === 'activity' && renderActivity()}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    marginTop: spacing.xxs,
  },
  tabScrollView: {
    marginBottom: spacing.xl,
    marginHorizontal: -16,
  },
  tabScrollContent: {
    paddingHorizontal: spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  tabText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  sectionTitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
  },
  kpiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  kpiLabel: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
  },
  kpiValue: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    marginTop: spacing.xs,
    letterSpacing: -0.5,
  },
  kpiIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  featureLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
  },
  featureValue: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  subscriptionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  subscriptionCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  subscriptionValue: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  subscriptionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    marginTop: spacing.xs,
  },
  demoToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  },
  demoToolButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
  },
  demoToolHint: {
    fontSize: typography.captionSmall.fontSize,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  usersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xxs,
  },
  userBusiness: {
    fontSize: typography.captionSmall.fontSize,
    marginTop: spacing.xs,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: spacing.lg,
  },
  userMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userMetaText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
  },
  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  healthName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
  },
  healthDetail: {
    fontSize: typography.captionSmall.fontSize,
    marginTop: spacing.xxs,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthStatus: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    textTransform: 'capitalize',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  performanceCard: {
    width: '48%',
    flexGrow: 1,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
  },
  performanceLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
  },
  performanceValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  activityTimeline: {
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 21,
    top: 20,
    bottom: 20,
    width: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: spacing.md,
  },
  activityIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  activityLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  activityUser: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xxs,
  },
  activityDetails: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xxs,
  },
  activityTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xxs,
  },
  activityTimeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    marginTop: spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    maxWidth: 260,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  accessDeniedIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  accessDeniedTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  accessDeniedButton: {
    marginTop: 28,
    paddingVertical: 14,
    paddingHorizontal: spacing['3xl'],
    borderRadius: 12,
  },
  accessDeniedButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
});
