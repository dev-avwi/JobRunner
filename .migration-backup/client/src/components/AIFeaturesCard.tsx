import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Mic, Route, Package, Brain, ChevronRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIFeature {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'available' | 'coming_soon' | 'beta';
  onClick?: () => void;
}

interface AIFeaturesCardProps {
  onNavigate?: (path: string) => void;
  className?: string;
}

export function AIFeaturesCard({ onNavigate, className }: AIFeaturesCardProps) {
  const features: AIFeature[] = [
    {
      id: 'schedule',
      icon: <Route className="h-4 w-4" />,
      title: 'Smart Scheduling',
      description: 'AI optimises your daily route',
      status: 'available',
      onClick: () => onNavigate?.('/schedule')
    },
    {
      id: 'voice',
      icon: <Mic className="h-4 w-4" />,
      title: 'Voice Notes',
      description: 'Transcribe job notes automatically',
      status: 'available'
    },
    {
      id: 'quotes',
      icon: <Package className="h-4 w-4" />,
      title: 'Multi-Option Quotes',
      description: 'Give clients pricing choices',
      status: 'available'
    },
    {
      id: 'assistant',
      icon: <Brain className="h-4 w-4" />,
      title: 'AI Assistant',
      description: 'Get business suggestions',
      status: 'available'
    }
  ];

  const getStatusBadge = (status: AIFeature['status']) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs">Available</Badge>;
      case 'beta':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200 text-xs">Early Access</Badge>;
      case 'coming_soon':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-200 text-xs">Coming Soon</Badge>;
    }
  };

  return (
    <Card className={cn("border-2 border-primary/10", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          AI-Powered Features
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            4 Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              feature.status === 'coming_soon' ? "opacity-60 cursor-not-allowed" :
              feature.onClick ? "cursor-pointer hover-elevate" : ""
            )}
            onClick={feature.status !== 'coming_soon' ? feature.onClick : undefined}
            data-testid={`ai-feature-${feature.id}`}
          >
            <div className="p-2 rounded-lg bg-muted flex-shrink-0">
              {feature.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">{feature.title}</span>
                {getStatusBadge(feature.status)}
              </div>
              <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
            </div>
            {feature.onClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}

        {/* AI Tip */}
        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/30">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">AI Tip:</span> Use the AI Schedule Optimiser 
              before starting your day to minimise travel time between jobs.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AIFeaturesCard;
