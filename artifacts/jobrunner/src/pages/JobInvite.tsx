import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, Building2, CheckCircle, XCircle, Clock, Loader2, UserPlus, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface InviteDetails {
  invite: {
    id: string;
    role: string;
    permissions: string[];
    status: string;
    createdAt: string;
  };
  job: {
    title: string;
    address?: string;
  };
  business: {
    companyName: string;
  };
}

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface JobInviteProps {
  code: string;
}

export default function JobInvite({ code }: JobInviteProps) {
  const [, setLocation] = useLocation();
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: inviteData, isLoading: inviteLoading, error: inviteError } = useQuery<InviteDetails>({
    queryKey: ['/api/invite', code],
    queryFn: async () => {
      const res = await fetch(`/api/invite/${code}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch invite');
      }
      return res.json();
    },
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/invite/${code}/accept`);
      return response.json();
    },
    onSuccess: (data) => {
      setLocation(`/jobs/${data.jobId}`);
    },
    onError: (error: Error) => {
      setAcceptError(error.message);
    },
  });

  const handleAccept = () => {
    if (!currentUser) {
      localStorage.setItem('pendingInviteCode', code);
      setLocation('/');
      return;
    }
    acceptMutation.mutate();
  };

  useEffect(() => {
    if (currentUser) {
      const pendingCode = localStorage.getItem('pendingInviteCode');
      if (pendingCode === code) {
        localStorage.removeItem('pendingInviteCode');
        acceptMutation.mutate();
      }
    }
  }, [currentUser, code]);

  if (inviteLoading || userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading invite details...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    const errorMessage = inviteError instanceof Error ? inviteError.message : 'Failed to load invite';
    const isExpired = errorMessage.includes('expired');
    const isRevoked = errorMessage.includes('revoked');
    const isAccepted = errorMessage.includes('accepted');

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {isExpired ? (
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            ) : isRevoked ? (
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            ) : isAccepted ? (
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            )}
            <CardTitle>
              {isExpired ? 'Invite Expired' : isRevoked ? 'Invite Revoked' : isAccepted ? 'Already Accepted' : 'Invite Not Found'}
            </CardTitle>
            <CardDescription>
              {isExpired && 'This job invite has expired. Please ask for a new invite link.'}
              {isRevoked && 'This invite has been cancelled by the owner.'}
              {isAccepted && 'This invite has already been used.'}
              {!isExpired && !isRevoked && !isAccepted && 'The invite link is invalid or has been removed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation('/')}
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  const { invite, job, business } = inviteData;

  const roleLabel = invite.role === 'subcontractor' ? 'Subcontractor' : 'Viewer';
  const permissionLabels: Record<string, string> = {
    'view_job': 'View Job Details',
    'add_notes': 'Add Notes',
    'add_photos': 'Add Photos',
    'update_status': 'Update Status',
    'view_client': 'View Client Info',
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            {business.companyName} has invited you to collaborate on a job
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Job</p>
                <p className="font-medium">{job.title}</p>
              </div>
            </div>

            {job.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{job.address}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{business.companyName}</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Your role:</p>
            <Badge variant="secondary" className="mb-3">{roleLabel}</Badge>
            
            <p className="text-sm text-muted-foreground mb-2">Permissions:</p>
            <div className="flex flex-wrap gap-2">
              {(invite.permissions as string[]).map((perm) => (
                <Badge key={perm} variant="outline" className="text-xs">
                  {permissionLabels[perm] || perm}
                </Badge>
              ))}
            </div>
          </div>

          {acceptError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {acceptError}
            </div>
          )}

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : currentUser ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept Invite
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign In to Accept
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation('/')}
            >
              Cancel
            </Button>
          </div>

          {!currentUser && (
            <p className="text-xs text-center text-muted-foreground">
              You'll need to sign in or create an account to accept this invite
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
