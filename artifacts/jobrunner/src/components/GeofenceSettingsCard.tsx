import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Radio, Clock, LogIn, LogOut, Settings, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GeofenceSettingsCardProps {
  jobId: string;
  hasLocation: boolean;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
  assignedTo?: string | null;
  readOnly?: boolean;
}

export default function GeofenceSettingsCard({
  jobId,
  hasLocation,
  geofenceEnabled = false,
  geofenceRadius = 100,
  geofenceAutoClockIn = false,
  geofenceAutoClockOut = false,
  assignedTo,
  readOnly = false,
}: GeofenceSettingsCardProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(geofenceEnabled);
  const [radius, setRadius] = useState(geofenceRadius);
  const [autoClockIn, setAutoClockIn] = useState(geofenceAutoClockIn);
  const [autoClockOut, setAutoClockOut] = useState(geofenceAutoClockOut);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      geofenceEnabled?: boolean;
      geofenceRadius?: number;
      geofenceAutoClockIn?: boolean;
      geofenceAutoClockOut?: boolean;
    }) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}/geofence`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Geofence Updated",
        description: "Geofence settings have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update geofence settings",
        variant: "destructive",
      });
    },
  });

  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    updateMutation.mutate({ geofenceEnabled: checked });
  };

  const handleRadiusChange = (value: number[]) => {
    setRadius(value[0]);
  };

  const handleRadiusCommit = () => {
    updateMutation.mutate({ geofenceRadius: radius });
  };

  const handleAutoClockInChange = (checked: boolean) => {
    setAutoClockIn(checked);
    updateMutation.mutate({ geofenceAutoClockIn: checked });
  };

  const handleAutoClockOutChange = (checked: boolean) => {
    setAutoClockOut(checked);
    updateMutation.mutate({ geofenceAutoClockOut: checked });
  };

  if (!hasLocation) {
    return (
      <Card data-testid="card-geofence-settings">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Geofence Time Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin className="h-4 w-4" />
            <span>Add a job address with coordinates to enable geofencing</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-geofence-settings">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Geofence Time Tracking
          </div>
          {enabled && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="geofence-enabled" className="text-sm font-medium">
              Enable Geofence
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically detect when team arrives at job site
            </p>
          </div>
          <Switch
            id="geofence-enabled"
            checked={enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={readOnly || updateMutation.isPending}
            data-testid="switch-geofence-enabled"
          />
        </div>

        {!enabled && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>This job has GPS coordinates. Enable geofencing for automatic time tracking when workers arrive.</span>
          </div>
        )}

        {enabled && !assignedTo && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Assign a worker to this job for geofence auto clock-in/out to work.</span>
          </div>
        )}

        {enabled && (
          <>
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Detection Radius</Label>
                  <span className="text-sm font-medium">{radius}m</span>
                </div>
                <Slider
                  value={[radius]}
                  onValueChange={handleRadiusChange}
                  onValueCommit={handleRadiusCommit}
                  min={50}
                  max={500}
                  step={25}
                  disabled={readOnly || updateMutation.isPending}
                  data-testid="slider-geofence-radius"
                />
                <p className="text-xs text-muted-foreground">
                  How close team members need to be to trigger geofence
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-600" />
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-clock-in" className="text-sm font-medium">
                      Auto Clock-In
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Start timer when arriving at site
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-clock-in"
                  checked={autoClockIn}
                  onCheckedChange={handleAutoClockInChange}
                  disabled={readOnly || updateMutation.isPending}
                  data-testid="switch-auto-clock-in"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-orange-600" />
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-clock-out" className="text-sm font-medium">
                      Auto Clock-Out
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Stop timer when leaving site
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-clock-out"
                  checked={autoClockOut}
                  onCheckedChange={handleAutoClockOutChange}
                  disabled={readOnly || updateMutation.isPending}
                  data-testid="switch-auto-clock-out"
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Settings className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <p>
                  Team members need location permissions enabled on their device. 
                  Geofence events are logged and visible on the map.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
