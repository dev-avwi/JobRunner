import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  AlertTriangle,
  HardHat,
  Loader2,
  FileText,
  X,
  Camera,
  Shield,
  Info,
  CheckCircle2,
} from "lucide-react";

interface SwmsBuilderProps {
  jobId: string;
  jobTitle?: string;
  jobAddress?: string;
  swmsId?: string;
  onClose?: () => void;
}

interface SwmsTemplate {
  id: string;
  title: string;
  description: string;
}

interface SwmsTemplateDetail {
  id: string;
  title: string;
  description: string;
  workActivityDescription?: string;
  hazards: HazardRow[];
  ppeRequirements: string[];
}

interface HazardRow {
  id?: string;
  hazardDescription: string;
  riskConsequence: string;
  likelihood: string;
  consequence: string;
  riskRating: string;
  controlMeasures: string;
  residualLikelihood: string;
  residualConsequence: string;
  residualRiskRating: string;
  responsiblePerson: string;
}

interface SwmsDocument {
  id: string;
  title: string;
  description?: string;
  jobId: string;
  siteAddress?: string;
  workActivityDescription?: string;
  ppeRequirements?: string[];
  emergencyContact?: string;
  firstAidLocation?: string;
  status: string;
  hazards: HazardRow[];
  signatures: any[];
}

interface DetectedHazard {
  activityTask: string;
  hazard: string;
  likelihood: number;
  consequence: number;
  controlMeasures: string;
  suggestedPPE: string[];
}

interface HazardScanResult {
  hazards: DetectedHazard[];
  disclaimer: string;
}

type RiskMatrix = Record<string, Record<string, string>>;

const LIKELIHOOD_OPTIONS = [
  { value: "rare", label: "Rare" },
  { value: "unlikely", label: "Unlikely" },
  { value: "possible", label: "Possible" },
  { value: "likely", label: "Likely" },
  { value: "almost_certain", label: "Almost Certain" },
];

const CONSEQUENCE_OPTIONS = [
  { value: "insignificant", label: "Insignificant" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
  { value: "catastrophic", label: "Catastrophic" },
];

const PPE_OPTIONS = [
  { value: "hard_hat", label: "Hard Hat" },
  { value: "safety_glasses", label: "Safety Glasses" },
  { value: "hi_vis", label: "Hi-Vis Vest" },
  { value: "steel_caps", label: "Steel Cap Boots" },
  { value: "hearing_protection", label: "Hearing Protection" },
  { value: "dust_mask", label: "Dust Mask" },
  { value: "gloves", label: "Gloves" },
  { value: "fall_harness", label: "Fall Harness" },
  { value: "face_shield", label: "Face Shield" },
  { value: "sun_protection", label: "Sun Protection" },
];

const LIKELIHOOD_NUM_TO_STRING: Record<number, string> = {
  1: "rare",
  2: "unlikely",
  3: "possible",
  4: "likely",
  5: "almost_certain",
};

const CONSEQUENCE_NUM_TO_STRING: Record<number, string> = {
  1: "insignificant",
  2: "minor",
  3: "moderate",
  4: "major",
  5: "catastrophic",
};

function getRiskLevelFromNumbers(likelihood: number, consequence: number): string {
  const score = likelihood * consequence;
  if (score <= 4) return "low";
  if (score <= 9) return "medium";
  if (score <= 16) return "high";
  return "extreme";
}

function emptyHazard(): HazardRow {
  return {
    hazardDescription: "",
    riskConsequence: "",
    likelihood: "possible",
    consequence: "moderate",
    riskRating: "",
    controlMeasures: "",
    residualLikelihood: "unlikely",
    residualConsequence: "minor",
    residualRiskRating: "",
    responsiblePerson: "",
  };
}

function getRiskBadgeClass(risk: string): string {
  switch (risk) {
    case "low":
      return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "high":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "extreme":
      return "bg-red-900/15 text-red-900 dark:text-red-300 border-red-900/30";
    default:
      return "";
  }
}

function calculateRisk(
  likelihood: string,
  consequence: string,
  matrix: RiskMatrix | undefined
): string {
  if (!matrix || !likelihood || !consequence) return "";
  return matrix[likelihood]?.[consequence] || "";
}

export function SwmsBuilder({
  jobId,
  jobTitle,
  jobAddress,
  swmsId,
  onClose,
}: SwmsBuilderProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(jobTitle ? `SWMS - ${jobTitle}` : "");
  const [siteAddress, setSiteAddress] = useState(jobAddress || "");
  const [workActivityDescription, setWorkActivityDescription] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [firstAidLocation, setFirstAidLocation] = useState("");
  const [selectedPpe, setSelectedPpe] = useState<string[]>([]);
  const [hazards, setHazards] = useState<HazardRow[]>([emptyHazard()]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [scanResults, setScanResults] = useState<DetectedHazard[]>([]);
  const [scanDisclaimer, setScanDisclaimer] = useState<string>("");
  const [selectedScanHazards, setSelectedScanHazards] = useState<Set<number>>(new Set());
  const [showScanResults, setShowScanResults] = useState(false);

  const { data: riskMatrix } = useQuery<RiskMatrix>({
    queryKey: ["/api/swms/risk-matrix"],
    staleTime: 60000,
  });

  const { data: templates } = useQuery<SwmsTemplate[]>({
    queryKey: ["/api/swms/templates"],
    staleTime: 60000,
  });

  const { data: existingSwms, isLoading: loadingExisting } =
    useQuery<SwmsDocument>({
      queryKey: ["/api/swms", swmsId],
      enabled: !!swmsId,
    });

  useEffect(() => {
    if (existingSwms) {
      setTitle(existingSwms.title || "");
      setSiteAddress(existingSwms.siteAddress || "");
      setWorkActivityDescription(existingSwms.workActivityDescription || "");
      setEmergencyContact(existingSwms.emergencyContact || "");
      setFirstAidLocation(existingSwms.firstAidLocation || "");
      setSelectedPpe(existingSwms.ppeRequirements || []);
      if (existingSwms.hazards && existingSwms.hazards.length > 0) {
        setHazards(existingSwms.hazards);
      }
    }
  }, [existingSwms]);

  const loadTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest(
        "GET",
        `/api/swms/templates/${templateId}`
      );
      return (await res.json()) as SwmsTemplateDetail;
    },
    onSuccess: (template) => {
      setTitle(template.title || title);
      if (template.ppeRequirements) {
        setSelectedPpe(template.ppeRequirements);
      }
      if (template.workActivityDescription) {
        setWorkActivityDescription(template.workActivityDescription);
      }
      if (template.hazards && template.hazards.length > 0) {
        setHazards(
          template.hazards.map((h: any) => ({
            hazardDescription: h.activityTask || h.hazardDescription || "",
            riskConsequence: h.hazard || h.riskConsequence || "",
            likelihood: h.likelihood || "possible",
            consequence: h.consequence || "moderate",
            riskRating: h.riskBefore || h.riskRating || "",
            controlMeasures: h.controlMeasures || "",
            residualLikelihood: "unlikely",
            residualConsequence: "minor",
            residualRiskRating: h.riskAfter || h.residualRiskRating || "",
            responsiblePerson: h.responsiblePerson || "",
          }))
        );
      }
      toast({ title: "Template loaded", description: `Applied "${template.title}" template` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to load template", variant: "destructive" });
    },
  });

  const scanHazardsMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("jobContext", workActivityDescription || jobTitle || "General construction work");
      const res = await fetch("/api/swms/scan-hazards", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to scan for hazards");
      }
      return (await res.json()) as HazardScanResult;
    },
    onSuccess: (result) => {
      setScanResults(result.hazards);
      setScanDisclaimer(result.disclaimer);
      setSelectedScanHazards(new Set());
      setShowScanResults(true);
      if (result.hazards.length === 0) {
        toast({ title: "No hazards detected", description: "AI did not detect any hazards in the job photos." });
      } else {
        toast({ title: "Scan complete", description: `Found ${result.hazards.length} potential hazard${result.hazards.length === 1 ? "" : "s"}` });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Scan failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleScanHazard = (index: number) => {
    setSelectedScanHazards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const addSelectedHazards = () => {
    const newHazards: HazardRow[] = [];
    const newPpe = new Set(selectedPpe);

    selectedScanHazards.forEach((index) => {
      const detected = scanResults[index];
      if (!detected) return;

      const likelihoodStr = LIKELIHOOD_NUM_TO_STRING[detected.likelihood] || "possible";
      const consequenceStr = CONSEQUENCE_NUM_TO_STRING[detected.consequence] || "moderate";

      newHazards.push({
        hazardDescription: detected.activityTask,
        riskConsequence: detected.hazard,
        likelihood: likelihoodStr,
        consequence: consequenceStr,
        riskRating: calculateRisk(likelihoodStr, consequenceStr, riskMatrix) || getRiskLevelFromNumbers(detected.likelihood, detected.consequence),
        controlMeasures: detected.controlMeasures,
        residualLikelihood: "unlikely",
        residualConsequence: "minor",
        residualRiskRating: calculateRisk("unlikely", "minor", riskMatrix) || "low",
        responsiblePerson: "",
      });

      detected.suggestedPPE?.forEach((ppe) => newPpe.add(ppe));
    });

    if (newHazards.length > 0) {
      const filteredExisting = hazards.filter(
        (h) => h.hazardDescription || h.riskConsequence || h.controlMeasures
      );
      setHazards([...filteredExisting, ...newHazards]);
      setSelectedPpe(Array.from(newPpe));
      toast({
        title: "Hazards added",
        description: `Added ${newHazards.length} hazard${newHazards.length === 1 ? "" : "s"} to SWMS`,
      });
    }

    setShowScanResults(false);
    setScanResults([]);
    setSelectedScanHazards(new Set());
  };

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const body = {
        title,
        description: title,
        jobId,
        siteAddress,
        workActivityDescription,
        ppeRequirements: selectedPpe,
        emergencyContact,
        firstAidLocation,
        status,
        hazards: hazards.map((h) => ({
          activityTask: h.hazardDescription || 'Activity',
          hazard: h.riskConsequence || 'Hazard',
          likelihood: h.likelihood,
          consequence: h.consequence,
          riskBefore: calculateRisk(h.likelihood, h.consequence, riskMatrix) || 'medium',
          controlMeasures: h.controlMeasures,
          riskAfter: calculateRisk(h.residualLikelihood, h.residualConsequence, riskMatrix) || 'low',
        })),
      };

      if (swmsId) {
        const res = await apiRequest("PATCH", `/api/swms/${swmsId}`, body);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/swms", body);
        return res.json();
      }
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "swms"] });
      if (swmsId) {
        queryClient.invalidateQueries({ queryKey: ["/api/swms", swmsId] });
      }
      toast({
        title: status === "draft" ? "Draft saved" : "SWMS activated",
        description:
          status === "draft"
            ? "SWMS saved as draft"
            : "SWMS is now active and ready for signatures",
      });
      onClose?.();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save SWMS", variant: "destructive" });
    },
  });

  useEffect(() => {
    setHazards((prev) =>
      prev.map((h) => ({
        ...h,
        riskRating: calculateRisk(h.likelihood, h.consequence, riskMatrix),
        residualRiskRating: calculateRisk(
          h.residualLikelihood,
          h.residualConsequence,
          riskMatrix
        ),
      }))
    );
  }, [riskMatrix]);

  const updateHazard = (index: number, field: keyof HazardRow, value: string) => {
    setHazards((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (
        field === "likelihood" ||
        field === "consequence"
      ) {
        updated[index].riskRating = calculateRisk(
          field === "likelihood" ? value : updated[index].likelihood,
          field === "consequence" ? value : updated[index].consequence,
          riskMatrix
        );
      }
      if (
        field === "residualLikelihood" ||
        field === "residualConsequence"
      ) {
        updated[index].residualRiskRating = calculateRisk(
          field === "residualLikelihood" ? value : updated[index].residualLikelihood,
          field === "residualConsequence" ? value : updated[index].residualConsequence,
          riskMatrix
        );
      }
      return updated;
    });
  };

  const addHazard = () => setHazards((prev) => [...prev, emptyHazard()]);
  const removeHazard = (index: number) =>
    setHazards((prev) => prev.filter((_, i) => i !== index));

  const togglePpe = (value: string) => {
    setSelectedPpe((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  if (swmsId && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!swmsId && templates && templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Start from Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger className="flex-1 min-w-[200px]">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={
                  !selectedTemplateId || loadTemplateMutation.isPending
                }
                onClick={() => {
                  if (selectedTemplateId)
                    loadTemplateMutation.mutate(selectedTemplateId);
                }}
              >
                {loadTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Apply Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="swms-title">Title</Label>
            <Input
              id="swms-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="SWMS document title"
            />
          </div>
          <div>
            <Label htmlFor="swms-site-address">Site Address</Label>
            <Input
              id="swms-site-address"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Work site address"
            />
          </div>
          <div>
            <Label htmlFor="swms-date">Date</Label>
            <Input
              id="swms-date"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              disabled
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Work Activity Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={workActivityDescription}
            onChange={(e) => setWorkActivityDescription(e.target.value)}
            placeholder="Describe the high-risk construction work being performed..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Hazard & Risk Assessment
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={scanHazardsMutation.isPending}
                onClick={() => scanHazardsMutation.mutate()}
              >
                {scanHazardsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <span className="flex items-center gap-0.5 mr-1">
                    <Camera className="h-4 w-4" />
                    <Shield className="h-3 w-3" />
                  </span>
                )}
                {scanHazardsMutation.isPending ? "Scanning for hazards..." : "Scan Job Photos"}
              </Button>
              <Button size="sm" variant="outline" onClick={addHazard}>
                <Plus className="h-4 w-4 mr-1" />
                Add Hazard
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showScanResults && scanResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {scanDisclaimer || "AI suggestions — review carefully before adding to SWMS"}
                </p>
              </div>

              <div className="space-y-2">
                {scanResults.map((detected, idx) => {
                  const riskLevel = getRiskLevelFromNumbers(detected.likelihood, detected.consequence);
                  const isSelected = selectedScanHazards.has(idx);
                  return (
                    <div
                      key={idx}
                      className={`border rounded-md p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border"
                      }`}
                      onClick={() => toggleScanHazard(idx)}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleScanHazard(idx)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{detected.activityTask}</span>
                            <Badge
                              variant="outline"
                              className={getRiskBadgeClass(riskLevel)}
                            >
                              {riskLevel.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{detected.hazard}</p>
                          <p className="text-xs">
                            <span className="text-muted-foreground">Controls: </span>
                            {detected.controlMeasures}
                          </p>
                          {detected.suggestedPPE && detected.suggestedPPE.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">PPE:</span>
                              {detected.suggestedPPE.map((ppe) => {
                                const ppeLabel = PPE_OPTIONS.find(
                                  (o) => o.value === ppe || o.value === ppe.replace(/-/g, "_")
                                )?.label || ppe.replace(/_/g, " ");
                                return (
                                  <Badge key={ppe} variant="secondary" className="text-[10px]">
                                    {ppeLabel}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowScanResults(false);
                    setScanResults([]);
                    setSelectedScanHazards(new Set());
                  }}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  disabled={selectedScanHazards.size === 0}
                  onClick={addSelectedHazards}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Add Selected to SWMS ({selectedScanHazards.size})
                </Button>
              </div>
            </div>
          )}

          {hazards.map((hazard, idx) => (
            <div
              key={idx}
              className="border rounded-md p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Hazard {idx + 1}
                </span>
                {hazards.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeHazard(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div>
                <Label>Hazard Description</Label>
                <Textarea
                  value={hazard.hazardDescription}
                  onChange={(e) =>
                    updateHazard(idx, "hazardDescription", e.target.value)
                  }
                  placeholder="Describe the hazard..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Potential Consequence</Label>
                <Input
                  value={hazard.riskConsequence}
                  onChange={(e) =>
                    updateHazard(idx, "riskConsequence", e.target.value)
                  }
                  placeholder="What could happen if not controlled?"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Initial Likelihood</Label>
                  <Select
                    value={hazard.likelihood}
                    onValueChange={(v) => updateHazard(idx, "likelihood", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIKELIHOOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Initial Consequence</Label>
                  <Select
                    value={hazard.consequence}
                    onValueChange={(v) => updateHazard(idx, "consequence", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSEQUENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hazard.riskRating && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Initial Risk:
                  </span>
                  <Badge
                    variant="outline"
                    className={getRiskBadgeClass(hazard.riskRating)}
                  >
                    {hazard.riskRating.toUpperCase()}
                  </Badge>
                </div>
              )}

              <div>
                <Label>Control Measures</Label>
                <Textarea
                  value={hazard.controlMeasures}
                  onChange={(e) =>
                    updateHazard(idx, "controlMeasures", e.target.value)
                  }
                  placeholder="How will this hazard be controlled?"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Residual Likelihood</Label>
                  <Select
                    value={hazard.residualLikelihood}
                    onValueChange={(v) =>
                      updateHazard(idx, "residualLikelihood", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIKELIHOOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Residual Consequence</Label>
                  <Select
                    value={hazard.residualConsequence}
                    onValueChange={(v) =>
                      updateHazard(idx, "residualConsequence", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSEQUENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hazard.residualRiskRating && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Residual Risk:
                  </span>
                  <Badge
                    variant="outline"
                    className={getRiskBadgeClass(hazard.residualRiskRating)}
                  >
                    {hazard.residualRiskRating.toUpperCase()}
                  </Badge>
                </div>
              )}

              <div>
                <Label>Responsible Person</Label>
                <Input
                  value={hazard.responsiblePerson}
                  onChange={(e) =>
                    updateHazard(idx, "responsiblePerson", e.target.value)
                  }
                  placeholder="Who is responsible for this control?"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardHat className="h-4 w-4" />
            PPE Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {PPE_OPTIONS.map((ppe) => (
              <label
                key={ppe.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={selectedPpe.includes(ppe.value)}
                  onCheckedChange={() => togglePpe(ppe.value)}
                />
                {ppe.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Emergency Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="swms-emergency">Emergency Contact</Label>
            <Input
              id="swms-emergency"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Emergency contact name and number"
            />
          </div>
          <div>
            <Label htmlFor="swms-firstaid">First Aid Location</Label>
            <Input
              id="swms-firstaid"
              value={firstAidLocation}
              onChange={(e) => setFirstAidLocation(e.target.value)}
              placeholder="Location of first aid kit"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          variant="outline"
          disabled={saveMutation.isPending || !title.trim()}
          onClick={() => saveMutation.mutate("draft")}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save as Draft
        </Button>
        <Button
          disabled={saveMutation.isPending || !title.trim()}
          onClick={() => saveMutation.mutate("active")}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Activate SWMS
        </Button>
      </div>
    </div>
  );
}
