import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PaintBucket, Info } from "lucide-react";
import CalculatorResult from "./CalculatorResult";

export default function PaintCoverageCalc() {
  const [wallHeight, setWallHeight] = useState("");
  const [perimeter, setPerimeter] = useState("");
  const [doorCount, setDoorCount] = useState("0");
  const [windowCount, setWindowCount] = useState("0");
  const [twoCoats, setTwoCoats] = useState(true);
  const [calculated, setCalculated] = useState(false);

  const COVERAGE_PER_LITRE = 12;
  const DOOR_AREA = 1.9;
  const WINDOW_AREA = 1.5;

  const results = useMemo(() => {
    const height = parseFloat(wallHeight);
    const perim = parseFloat(perimeter);
    const doors = parseInt(doorCount) || 0;
    const windows = parseInt(windowCount) || 0;

    if (!height || !perim || height <= 0 || perim <= 0) {
      return null;
    }

    const grossArea = height * perim;
    const doorExclusion = doors * DOOR_AREA;
    const windowExclusion = windows * WINDOW_AREA;
    const netArea = Math.max(0, grossArea - doorExclusion - windowExclusion);
    
    const coatMultiplier = twoCoats ? 2 : 1;
    const paintableArea = netArea * coatMultiplier;
    const litresNeeded = Math.ceil(paintableArea / COVERAGE_PER_LITRE);

    return {
      grossArea: grossArea.toFixed(2),
      doorExclusion: doorExclusion.toFixed(2),
      windowExclusion: windowExclusion.toFixed(2),
      netArea: netArea.toFixed(2),
      paintableArea: paintableArea.toFixed(2),
      litresNeeded,
    };
  }, [wallHeight, perimeter, doorCount, windowCount, twoCoats]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
    }
  };

  const handleReset = () => {
    setWallHeight("");
    setPerimeter("");
    setDoorCount("0");
    setWindowCount("0");
    setTwoCoats(true);
    setCalculated(false);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-paint-calculator">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <PaintBucket className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <CardTitle>Paint Coverage Calculator</CardTitle>
              <CardDescription>Calculate paint needed for walls with door/window exclusions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-purple-500/10 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Assuming standard coverage of 12m² per litre. Standard door = 1.9m², window = 1.5m². Two coats recommended for best finish.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wallHeight">Wall Height (m)</Label>
                <Input
                  id="wallHeight"
                  type="number"
                  placeholder="e.g., 2.4"
                  value={wallHeight}
                  onChange={(e) => {
                    setWallHeight(e.target.value);
                    setCalculated(false);
                  }}
                  step="0.1"
                  data-testid="input-wall-height"
                />
                <p className="text-xs text-muted-foreground">Standard ceiling height is 2.4m</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="perimeter">Room Perimeter (m)</Label>
                <Input
                  id="perimeter"
                  type="number"
                  placeholder="e.g., 20"
                  value={perimeter}
                  onChange={(e) => {
                    setPerimeter(e.target.value);
                    setCalculated(false);
                  }}
                  step="0.1"
                  data-testid="input-perimeter"
                />
                <p className="text-xs text-muted-foreground">Total length of all walls</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doorCount">Number of Doors</Label>
                <Input
                  id="doorCount"
                  type="number"
                  placeholder="0"
                  value={doorCount}
                  onChange={(e) => {
                    setDoorCount(e.target.value);
                    setCalculated(false);
                  }}
                  min="0"
                  data-testid="input-door-count"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="windowCount">Number of Windows</Label>
                <Input
                  id="windowCount"
                  type="number"
                  placeholder="0"
                  value={windowCount}
                  onChange={(e) => {
                    setWindowCount(e.target.value);
                    setCalculated(false);
                  }}
                  min="0"
                  data-testid="input-window-count"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Two Coats</p>
                <p className="text-xs text-muted-foreground">Recommended for professional finish</p>
              </div>
              <Switch
                checked={twoCoats}
                onCheckedChange={(checked) => {
                  setTwoCoats(checked);
                  setCalculated(false);
                }}
                data-testid="switch-two-coats"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleCalculate}
              disabled={!results}
              className="flex-1"
              variant="brand"
              data-testid="button-calculate"
            >
              Calculate
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {calculated && results && (
        <CalculatorResult
          title="Paint Coverage Results"
          results={[
            { label: "Litres Needed", value: results.litresNeeded, unit: "L", highlight: true },
            { label: "Net Wall Area", value: results.netArea, unit: "m²" },
            { label: "Paintable Area", value: results.paintableArea, unit: `m² (${twoCoats ? '2 coats' : '1 coat'})` },
            { label: "Gross Wall Area", value: results.grossArea, unit: "m²" },
            { label: "Door Exclusion", value: results.doorExclusion, unit: `m² (${doorCount} doors)` },
            { label: "Window Exclusion", value: results.windowExclusion, unit: `m² (${windowCount} windows)` },
          ]}
          quoteDescription={`Paint - ${results.litresNeeded}L for ${results.netArea}m² wall area${twoCoats ? ' (2 coats)' : ' (1 coat)'}`}
          quoteQuantity={results.litresNeeded}
          quoteUnit="L"
        />
      )}
    </div>
  );
}
