import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { WORKER_PERMISSIONS, type WorkerPermission } from "@shared/schema";

export type UserRoleType = "owner" | "manager" | "office_admin" | "tradie" | "loading";

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface BusinessSettings {
  id: string;
  userId: string;
  businessName: string;
  teamSize: string;
}

interface TeamMemberInfo {
  roleId?: string;
  roleName?: string;
  role?: string;
  permissions: Record<string, boolean> | string[];
  isOwner?: boolean;
  hasCustomPermissions?: boolean;
  customPermissions?: string[] | null;
}

export { WORKER_PERMISSIONS };

async function fetchTeamRole(): Promise<TeamMemberInfo | null> {
  // Must include the Bearer token — app is Bearer-only; credentials:"include" alone
  // doesn't attach the token and silently 401s, leaving permissions empty.
  const token = localStorage.getItem('jobrunner_session_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch("/api/team/my-role", { headers });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Error fetching team role: ${res.status}`);
  }
  return res.json();
}

export function useUserRole() {
  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const { data: businessSettings, isLoading: settingsLoading } = useQuery<BusinessSettings>({ queryKey: ["/api/business-settings"] });
  
  const { data: teamMemberInfo, isLoading: teamRoleLoading } = useQuery<TeamMemberInfo | null>({
    queryKey: ["/api/team/my-role"],
    queryFn: fetchTeamRole,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = userLoading || settingsLoading || teamRoleLoading;

  const getUserRole = (): UserRoleType => {
    if (isLoading) return "loading";
    
    if (teamMemberInfo) {
      if (teamMemberInfo.isOwner || teamMemberInfo.role === 'owner') {
        return "owner";
      }
      
      if (teamMemberInfo.roleName) {
        const roleName = teamMemberInfo.roleName.toLowerCase();
        if (roleName.includes("office") && roleName.includes("admin")) {
          return "office_admin";
        }
        if (roleName.includes("manager") || roleName.includes("admin")) {
          return "manager";
        }
        return "tradie";
      }
    }
    
    if (businessSettings && user && businessSettings.userId === user.id) {
      return "owner";
    }
    
    return "owner";
  };

  const role = getUserRole();
  // Human-readable role name from the server (e.g. "Subcontractor", "Manager").
  const roleName = teamMemberInfo?.isOwner || teamMemberInfo?.role === 'owner'
    ? 'Owner'
    : teamMemberInfo?.roleName || null;
  const isSubcontractor = !!roleName && roleName.toLowerCase().includes("subcontractor");
  const isOwner = role === "owner";
  const isManager = role === "manager" || role === "office_admin";
  const isOfficeAdmin = role === "office_admin";
  const isTradie = role === "tradie";
  
  const hasCustomPermissions = teamMemberInfo?.hasCustomPermissions === true;
  
  const getPermissions = useCallback((): string[] => {
    if (isOwner) {
      return Object.values(WORKER_PERMISSIONS);
    }
    if (!teamMemberInfo?.permissions) return [];
    if (Array.isArray(teamMemberInfo.permissions)) {
      return teamMemberInfo.permissions;
    }
    return Object.entries(teamMemberInfo.permissions)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);
  }, [teamMemberInfo?.permissions, isOwner]);

  const permissions = getPermissions();

  const hasPermission = useCallback((key: string): boolean => {
    if (isOwner) return true;
    // Handle wildcard "*" permission (Administrator and other full-access roles)
    if (permissions.includes('*')) return true;
    return permissions.includes(key);
  }, [permissions, isOwner]);

  return {
    role,
    roleName,
    isSubcontractor,
    isOwner,
    isManager,
    isOfficeAdmin,
    isTradie,
    isLoading,
    permissions,
    hasPermission,
    hasCustomPermissions,
  };
}
