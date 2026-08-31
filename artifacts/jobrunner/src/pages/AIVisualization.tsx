import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import AIVisualization from "@/components/AIVisualization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Wand2, 
  Image as ImageIcon, 
  Clock, 
  ArrowLeft,
  Briefcase,
  Sparkles
} from "lucide-react";

interface Visualization {
  id: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  prompt: string;
  style: string;
  roomType: string;
  description: string;
  jobId?: string;
  jobTitle?: string;
  createdAt: string;
}

export default function AIVisualizationPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const jobIdFromUrl = params.get("jobId");
  const [activeTab, setActiveTab] = useState<string>("create");

  const { data: recentVisualizations, isLoading: isLoadingHistory } = useQuery<Visualization[]>({
    queryKey: ["/api/ai/visualizations"],
    enabled: activeTab === "gallery",
  });

  const { data: job } = useQuery<{ id: string; title: string; photos?: any[] }>({
    queryKey: ["/api/jobs", jobIdFromUrl],
    enabled: !!jobIdFromUrl,
  });

  const handleSaveToJob = async (imageUrl: string) => {
    if (!jobIdFromUrl) return;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styleLabels: Record<string, string> = {
    modern: "Modern",
    traditional: "Traditional",
    industrial: "Industrial",
    minimalist: "Minimalist",
    contemporary: "Contemporary",
    rustic: "Rustic",
  };

  const roomLabels: Record<string, string> = {
    bathroom: "Bathroom",
    kitchen: "Kitchen",
    living_room: "Living Room",
    bedroom: "Bedroom",
    exterior: "Exterior",
    laundry: "Laundry",
    garage: "Garage",
    office: "Office",
  };

  return (
    <PageShell>
      <PageHeader
        title="AI Visualization"
        subtitle="Generate before/after concept images for clients"
        leading={<Wand2 className="h-6 w-6" />}
        action={
          jobIdFromUrl ? (
            <Button
              variant="outline"
              onClick={() => setLocation(`/jobs/${jobIdFromUrl}`)}
              className="gap-2"
              data-testid="button-back-to-job"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Job
            </Button>
          ) : undefined
        }
      />
      {job && (
        <Card className="mb-6 bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Visualizing for job:</p>
                <p className="font-semibold">{job.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="gap-2" data-testid="tab-create">
            <Sparkles className="h-4 w-4" />
            Create New
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2" data-testid="tab-gallery">
            <ImageIcon className="h-4 w-4" />
            Gallery
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <AIVisualization
            jobId={jobIdFromUrl || undefined}
            onSaveToJob={jobIdFromUrl ? handleSaveToJob : undefined}
          />
        </TabsContent>

        <TabsContent value="gallery">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentVisualizations && recentVisualizations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentVisualizations.map((viz) => (
                <Card key={viz.id} className="overflow-hidden hover-elevate">
                  <div className="relative aspect-video">
                    <div className="absolute inset-0 grid grid-cols-2">
                      <div className="relative">
                        <img
                          src={viz.beforeImageUrl}
                          alt="Before"
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute bottom-1 left-1" variant="secondary">
                          Before
                        </Badge>
                      </div>
                      <div className="relative">
                        <img
                          src={viz.afterImageUrl}
                          alt="After"
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute bottom-1 right-1" variant="default">
                          After
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-sm line-clamp-2 mb-2">{viz.prompt}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline">{styleLabels[viz.style] || viz.style}</Badge>
                      <Badge variant="outline">{roomLabels[viz.roomType] || viz.roomType}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(viz.createdAt)}
                    </div>
                    {viz.jobTitle && (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs mt-2"
                        onClick={() => setLocation(`/jobs/${viz.jobId}`)}
                      >
                        <Briefcase className="h-3 w-3 mr-1" />
                        {viz.jobTitle}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No visualizations yet</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Create your first AI visualization to help clients envision their renovation
                </p>
                <Button onClick={() => setActiveTab("create")} data-testid="button-create-first">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Visualization
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
