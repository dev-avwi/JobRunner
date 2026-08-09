import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeftRight, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Download,
  Share2,
  Maximize2,
  SplitSquareHorizontal,
  Layers
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Photo {
  id: string;
  signedUrl?: string;
  fileName: string;
  caption?: string;
  category: 'before' | 'after' | 'progress' | 'materials' | 'general';
  createdAt: string;
}

interface BeforeAfterComparisonProps {
  isOpen: boolean;
  onClose: () => void;
  beforePhotos: Photo[];
  afterPhotos: Photo[];
  jobTitle?: string;
}

type ViewMode = 'side-by-side' | 'slider' | 'overlay';

export default function BeforeAfterComparison({
  isOpen,
  onClose,
  beforePhotos,
  afterPhotos,
  jobTitle = "Job"
}: BeforeAfterComparisonProps) {
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  const currentBefore = beforePhotos[beforeIndex];
  const currentAfter = afterPhotos[afterIndex];

  if (beforePhotos.length === 0 || afterPhotos.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Before/After Comparison</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">
              {beforePhotos.length === 0 && afterPhotos.length === 0 
                ? "No before or after photos yet"
                : beforePhotos.length === 0 
                  ? "No 'before' photos uploaded"
                  : "No 'after' photos uploaded"}
            </p>
            <p className="text-sm mt-2">
              Upload photos with 'Before' and 'After' categories to compare them side by side.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const navigateBefore = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setBeforeIndex(i => i > 0 ? i - 1 : beforePhotos.length - 1);
    } else {
      setBeforeIndex(i => i < beforePhotos.length - 1 ? i + 1 : 0);
    }
  };

  const navigateAfter = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setAfterIndex(i => i > 0 ? i - 1 : afterPhotos.length - 1);
    } else {
      setAfterIndex(i => i < afterPhotos.length - 1 ? i + 1 : 0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0" data-testid="before-after-modal">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              <DialogTitle>Before/After Comparison</DialogTitle>
              {jobTitle && (
                <Badge variant="secondary" className="font-normal">
                  {jobTitle}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === 'side-by-side' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setViewMode('side-by-side')}
                  data-testid="view-side-by-side"
                >
                  <SplitSquareHorizontal className="h-4 w-4 mr-1" />
                  Side by Side
                </Button>
                <Button
                  variant={viewMode === 'slider' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setViewMode('slider')}
                  data-testid="view-slider"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  Slider
                </Button>
                <Button
                  variant={viewMode === 'overlay' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setViewMode('overlay')}
                  data-testid="view-overlay"
                >
                  <Layers className="h-4 w-4 mr-1" />
                  Overlay
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-4">
          {viewMode === 'side-by-side' && (
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Before
                  </Badge>
                  {beforePhotos.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => navigateBefore('prev')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {beforeIndex + 1} / {beforePhotos.length}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => navigateBefore('next')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-muted rounded-xl overflow-hidden relative">
                  {currentBefore?.signedUrl && (
                    <img
                      src={currentBefore.signedUrl}
                      alt={currentBefore.caption || 'Before photo'}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                {currentBefore?.caption && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {currentBefore.caption}
                  </p>
                )}
              </div>

              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    After
                  </Badge>
                  {afterPhotos.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => navigateAfter('prev')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {afterIndex + 1} / {afterPhotos.length}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => navigateAfter('next')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-muted rounded-xl overflow-hidden relative">
                  {currentAfter?.signedUrl && (
                    <img
                      src={currentAfter.signedUrl}
                      alt={currentAfter.caption || 'After photo'}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                {currentAfter?.caption && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {currentAfter.caption}
                  </p>
                )}
              </div>
            </div>
          )}

          {viewMode === 'slider' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 relative bg-muted rounded-xl overflow-hidden">
                {currentAfter?.signedUrl && (
                  <img
                    src={currentAfter.signedUrl}
                    alt={currentAfter.caption || 'After photo'}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
                {currentBefore?.signedUrl && (
                  <div 
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPosition}%` }}
                  >
                    <img
                      src={currentBefore.signedUrl}
                      alt={currentBefore.caption || 'Before photo'}
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ 
                        minWidth: `${100 / (sliderPosition / 100)}%`,
                        maxWidth: `${100 / (sliderPosition / 100)}%`
                      }}
                    />
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-white shadow-lg" />
                  </div>
                )}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize"
                  style={{ left: `calc(${sliderPosition}% - 16px)` }}
                >
                  <ArrowLeftRight className="h-4 w-4 text-gray-600" />
                </div>
                <Badge className="absolute top-2 left-2 bg-amber-100 text-amber-800">Before</Badge>
                <Badge className="absolute top-2 right-2 bg-green-100 text-green-800">After</Badge>
              </div>
              <div className="mt-4 px-8">
                <Slider
                  value={[sliderPosition]}
                  onValueChange={(value) => setSliderPosition(value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>Before</span>
                  <span>After</span>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'overlay' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 relative bg-muted rounded-xl overflow-hidden">
                {currentBefore?.signedUrl && (
                  <img
                    src={currentBefore.signedUrl}
                    alt={currentBefore.caption || 'Before photo'}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
                {currentAfter?.signedUrl && (
                  <img
                    src={currentAfter.signedUrl}
                    alt={currentAfter.caption || 'After photo'}
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ opacity: overlayOpacity / 100 }}
                  />
                )}
              </div>
              <div className="mt-4 px-8">
                <Slider
                  value={[overlayOpacity]}
                  onValueChange={(value) => setOverlayOpacity(value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>Show Before</span>
                  <span>Show After</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {(viewMode === 'slider' || viewMode === 'overlay') && (beforePhotos.length > 1 || afterPhotos.length > 1) && (
          <div className="p-4 border-t flex items-center justify-center gap-8">
            {beforePhotos.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Before:</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => navigateBefore('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{beforeIndex + 1} / {beforePhotos.length}</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => navigateBefore('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {afterPhotos.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">After:</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => navigateAfter('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{afterIndex + 1} / {afterPhotos.length}</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => navigateAfter('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
