import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { 
  ChevronRight,
  Briefcase,
  FileType
} from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useAppMode } from "@/hooks/use-app-mode";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { getMorePageItems, type NavItem } from "@/lib/navigation-config";

interface MoreItem {
  title: string;
  description: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export default function More() {
  const { data: businessSettings } = useBusinessSettings();
  const { isTeam, isTradie, isOwner, isManager, userRole, permissionNavUrls } = useAppMode();
  
  const { isSimpleMode } = useSimpleMode();
  const { canUseAIFeatures } = useFeatureAccess();
  const morePageItems = getMorePageItems({ isTeam, isTradie, isOwner, isManager, userRole, isSimpleMode, hasProSubscription: canUseAIFeatures, extraAllowedUrls: permissionNavUrls });
  
  const allItems: MoreItem[] = morePageItems.map((item: NavItem) => ({
    title: item.title,
    description: item.description || item.title,
    url: item.url,
    icon: item.icon,
    color: item.color || "text-muted-foreground",
    bgColor: item.bgColor || "bg-muted/10",
  }));

  const logoElement = businessSettings?.logoUrl ? (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
      <img 
        src={businessSettings.logoUrl} 
        alt="Business logo" 
        className="w-full h-full object-contain"
        data-testid="img-business-logo"
      />
    </div>
  ) : (
    <div 
      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: 'hsl(var(--trade) / 0.15)', border: '1px solid hsl(var(--trade) / 0.3)' }}
    >
      <Briefcase 
        className="h-5 w-5" 
        style={{ color: 'hsl(var(--trade))' }}
      />
    </div>
  );

  return (
    <PageShell data-testid="page-more">
      <PageHeader
        title="More Features"
        subtitle="Additional tools for your business"
        leading={logoElement}
      />

      <div className="grid gap-4">
        {allItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.url} className="block">
              <Card className="hover-elevate active-elevate-2 transition-200" data-testid={`card-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg" data-testid={`text-${item.title.toLowerCase().replace(/\s+/g, '-')}-title`}>
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground" data-testid={`text-${item.title.toLowerCase().replace(/\s+/g, '-')}-description`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Quick Access</CardTitle>
          <CardDescription>
            Jump back to your main workflow tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/jobs" className="block">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-quick-jobs">
                <Briefcase className="h-4 w-4" />
                Jobs
              </Button>
            </Link>
            <Link href="/quotes" className="block">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-quick-quotes">
                <FileType className="h-4 w-4" />
                Quotes
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
