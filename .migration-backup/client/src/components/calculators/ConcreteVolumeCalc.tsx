import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Square, Info } from "lucide-react";
import CalculatorResult from "./CalculatorResult";

type Shape = "rectangle" | "circle";

export default function ConcreteVolumeCalc() {
  const [shape, setShape] = useState<Shape>("rectangle");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [diameter, setDiameter] = useState("");
  const [depth, setDepth] = useState("");
  const [includeWastage, setIncludeWastage] = useState(true);
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const d = parseFloat(depth);
    
    if (!d || d <= 0) {
      return null;
    }

    let baseVolume: number;

    if (shape === "rectangle") {
      const l = parseFloat(length);
      const w = parseFloat(width);
      if (!l || !w || l <= 0 || w <= 0) return null;
      baseVolume = l * w * d;
    } else {
      const dia = parseFloat(diameter);
      if (!dia || dia <= 0) return null;
      const radius = dia / 2;
      baseVolume = Math.PI * radius * radius * d;
    }

    const wastageMultiplier = includeWastage ? 1.10 : 1.0;
    const totalVolume = baseVolume * wastageMultiplier;
    const bagsNeeded = Math.ceil(totalVolume / 0.01);

    return {
      baseVolume: baseVolume.toFixed(3),
      wastageAmount: includeWastage ? (baseVolume * 0.10).toFixed(3) : "0.000",
      totalVolume: totalVolume.toFixed(3),
      bags20kg: bagsNeeded,
    };
  }, [shape, length, width, diameter, depth, includeWastage]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
    }
  };

  const handleReset = () => {
    setLength("");
    setWidth("");
    setDiameter("");
    setDepth("");
    setIncludeWastage(true);
    setCalculated(false);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-concrete-calculator">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Square className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <CardTitle>Concrete Volume Calculator</CardTitle>
              <CardDescription>Calculate cubic meters and premix bags for slabs, footings, and pads</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-amber-500/10 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              1 x 20kg bag of premix concrete yields approximately 0.01m³ (10 litres) of mixed concrete.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shape</Label>
              <Select value={shape} onValueChange={(v) => { setShape(v as Shape); setCalculated(false); }}>
                <SelectTrigger data-testid="select-shape">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rectangle">Rectangle / Square</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shape === "rectangle" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length">Length (m)</Label>
                  <Input
                    id="length"
                    type="number"
                    placeholder="e.g., 3.5"
                    value={length}
                    onChange={(e) => {
                      setLength(e.target.value);
                      setCalculated(false);
                    }}
                    step="0.01"
                    data-testid="input-length"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Width (m)</Label>
                  <Input
                    id="width"
                    type="number"
                    placeholder="e.g., 2.5"
                    value={width}
                    onChange={(e) => {
                      setWidth(e.target.value);
                      setCalculated(false);
                    }}
                    step="0.01"
                    data-testid="input-width"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depth">Depth (m)</Label>
                  <Input
                    id="depth"
                    type="number"
                    placeholder="e.g., 0.1"
                    value={depth}
                    onChange={(e) => {
                      setDepth(e.target.value);
                      setCalculated(false);
                    }}
                    step="0.01"
                    data-testid="input-depth"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="diameter">Diameter (m)</Label>
                  <Input
                    id="diameter"
                    type="number"
                    placeholder="e.g., 1.2"
                    value={diameter}
                    onChange={(e) => {
                      setDiameter(e.target.value);
                      setCalculated(false);
                    }}
                    step="0.01"
                    data-testid="input-diameter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depthCircle">Depth (m)</Label>
                  <Input
                    id="depthCircle"
                    type="number"
                    placeholder="e.g., 0.3"
                    value={depth}
                    onChange={(e) => {
                      setDepth(e.target.value);
                      setCalculated(false);
                    }}
                    step="0.01"
                    data-testid="input-depth-circle"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Include 10% Wastage</p>
                <p className="text-xs text-muted-foreground">Recommended for site conditions and spillage</p>
              </div>
              <Switch
                checked={includeWastage}
                onCheckedChange={(checked) => {
                  setIncludeWastage(checked);
                  setCalculated(false);
                }}
                data-testid="switch-wastage"
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
          title="Concrete Volume Results"
          results={[
            { label: "Total Volume", value: results.totalVolume, unit: "m³", highlight: true },
            { label: "Base Volume", value: results.baseVolume, unit: "m³" },
            { label: "Wastage (10%)", value: results.wastageAmount, unit: "m³" },
            { label: "20kg Bags Needed", value: results.bags20kg, unit: "bags", highlight: true },
          ]}
          quoteDescription={`Concrete - ${results.totalVolume}m³ (${results.bags20kg} x 20kg premix bags)${includeWastage ? ' incl. 10% wastage' : ''}`}
          quoteQuantity={parseFloat(results.totalVolume)}
          quoteUnit="m³"
        />
      )}
    </div>
  );
}
