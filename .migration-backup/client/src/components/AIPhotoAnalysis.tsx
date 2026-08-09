import { useState, useRef, useCallback } from "react";
import { Sparkles, Loader2, Check, X, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { Link } from "wouter";

interface AIPhotoAnalysisProps {
  jobId: string;
  photoCount: number;
  existingNotes?: string;
  onNotesUpdated?: () => void;
}

export function AIPhotoAnalysis({ jobId, photoCount, existingNotes, onNotesUpdated }: AIPhotoAnalysisProps) {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isAddingToNotes, setIsAddingToNotes] = useState(false);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const { data: settings } = useBusinessSettings();
  
  const aiEnabled = settings?.aiEnabled !== false;
  const photoAnalysisEnabled = settings?.aiPhotoAnalysisEnabled !== false;

  const startAnalysis = useCallback(async () => {
    if (isAnalysing) return;
    
    setIsAnalysing(true);
    setAnalysisText('');
    setIsComplete(false);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/photos/analyze`, {
        method: 'GET',
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyse photos');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setAnalysisText(prev => prev + data.text);
              }
              if (data.done) {
                setIsComplete(true);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }
      }
      
      setIsComplete(true);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Photo analysis error:', error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || "Could not analyse photos"
      });
      setAnalysisText('');
    } finally {
      setIsAnalysing(false);
    }
  }, [jobId, isAnalysing, toast]);

  const cancelAnalysis = () => {
    abortControllerRef.current?.abort();
    setIsAnalysing(false);
    setAnalysisText('');
    setIsComplete(false);
  };

  const addToNotes = async () => {
    if (!analysisText.trim()) return;
    
    setIsAddingToNotes(true);
    try {
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n--- AI Photo Analysis ---\n${analysisText}`
        : `--- AI Photo Analysis ---\n${analysisText}`;
      
      await apiRequest("PATCH", `/api/jobs/${jobId}`, { notes: newNotes });
      
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      
      toast({
        title: "Added to Notes",
        description: "Photo analysis has been added to job notes"
      });
      
      setAnalysisText('');
      setIsComplete(false);
      onNotesUpdated?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Add",
        description: error.message || "Could not add analysis to notes"
      });
    } finally {
      setIsAddingToNotes(false);
    }
  };

  const discardAnalysis = () => {
    setAnalysisText('');
    setIsComplete(false);
  };

  if (photoCount === 0) {
    return null;
  }

  if (!aiEnabled || !photoAnalysisEnabled) {
    return (
      <Card data-testid="card-ai-photo-analysis-disabled">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              AI Photo Analysis
              <Badge variant="outline" className="text-xs">Off</Badge>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            AI photo analysis is currently disabled.
          </p>
          <Link href="/settings">
            <Button variant="outline" size="sm" data-testid="button-enable-ai">
              <Settings className="mr-2 h-4 w-4" />
              Enable in Settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-ai-photo-analysis">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Photo Analysis
            <Badge variant="secondary" className="text-xs">Early Access</Badge>
          </span>
          {photoCount > 0 && !isAnalysing && !analysisText && (
            <Badge variant="outline" className="text-xs">
              {photoCount} photo{photoCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isAnalysing && !analysisText && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use AI to analyse your job photos and automatically generate notes with photo references.
            </p>
            <Button
              onClick={startAnalysis}
              className="w-full"
              data-testid="button-analyse-photos"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Analyse {photoCount} Photo{photoCount !== 1 ? 's' : ''}
            </Button>
          </div>
        )}

        {isAnalysing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analysing photos...</span>
            </div>
            {analysisText && (
              <div 
                className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-lg border max-h-64 overflow-y-auto"
                data-testid="text-analysis-streaming"
              >
                {analysisText}
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={cancelAnalysis}
              data-testid="button-cancel-analysis"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}

        {isComplete && analysisText && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Analysis complete</span>
            </div>
            <div 
              className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-lg border max-h-64 overflow-y-auto"
              data-testid="text-analysis-result"
            >
              {analysisText}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={addToNotes}
                disabled={isAddingToNotes}
                className="flex-1"
                data-testid="button-add-to-notes"
              >
                {isAddingToNotes ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add to Job Notes
              </Button>
              <Button
                variant="outline"
                onClick={discardAnalysis}
                disabled={isAddingToNotes}
                data-testid="button-discard-analysis"
              >
                <X className="mr-2 h-4 w-4" />
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
