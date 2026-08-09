import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Home, Info } from "lucide-react";
import CalculatorResult from "./CalculatorResult";

export default function RoofPitchCalc() {
  const [run, setRun] = useState("");
  const [rise, setRise] = useState("");
  const [roofLength, setRoofLength] = useState("");
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const runVal = parseFloat(run);
    const riseVal = parseFloat(rise);

    if (!runVal || !riseVal || runVal <= 0 || riseVal <= 0) {
      return null;
    }

    const pitchAngleRad = Math.atan(riseVal / runVal);
    const pitchAngleDeg = (pitchAngleRad * 180) / Math.PI;
    
    const pitchRatio = (riseVal / runVal) * 12;
    const rakerLength = Math.sqrt(runVal * runVal + riseVal * riseVal);
    
    let roofArea: number | null = null;
    const roofLengthVal = parseFloat(roofLength);
    if (roofLengthVal && roofLengthVal > 0) {
      roofArea = rakerLength * roofLengthVal * 2;
    }

    return {
      pitchAngle: pitchAngleDeg.toFixed(1),
      pitchRatio: pitchRatio.toFixed(1),
      rakerLength: rakerLength.toFixed(3),
      roofArea: roofArea?.toFixed(2),
    };
  }, [run, rise, roofLength]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
    }
  };

  const handleReset = () => {
    setRun("");
    setRise("");
    setRoofLength("");
    setCalculated(false);
  };

  const getPitchDescription = (angle: number) => {
    if (angle < 10) return "Low pitch (flat roof)";
    if (angle < 20) return "Low-medium pitch";
    if (angle < 35) return "Standard pitch";
    if (angle < 45) return "Steep pitch";
    return "Very steep pitch";
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-roof-calculator">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Home className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <CardTitle>Roof Pitch Calculator</CardTitle>
              <CardDescription>Calculate pitch angle, ratio, and roof area from rise and run measurements</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-amber-500/10 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-600 dark:text-amber-400">
              <p className="font-medium">Pitch Ratio Explained</p>
              <p>A 4:12 pitch means the roof rises 4 units for every 12 units of horizontal run. Common Australian roof pitches range from 15° to 25°.</p>
            </div>
          </div>

          <div className="relative p-6 bg-muted/30 rounded-lg">
            <svg viewBox="0 0 200 100" className="w-full max-w-xs mx-auto">
              <line x1="10" y1="80" x2="190" y2="80" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
              <line x1="10" y1="80" x2="10" y2="20" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" strokeDasharray="4" />
              <line x1="10" y1="20" x2="190" y2="80" stroke="hsl(var(--trade))" strokeWidth="3" />
              <text x="100" y="95" textAnchor="middle" className="text-xs fill-muted-foreground">Run (horizontal)</text>
              <text x="5" y="50" textAnchor="middle" className="text-xs fill-muted-foreground" transform="rotate(-90 5 50)">Rise</text>
              <text x="100" y="45" textAnchor="middle" className="text-xs" style={{ fill: 'hsl(var(--trade))' }}>Raker</text>
            </svg>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="run">Run - Horizontal (m)</Label>
                <Input
                  id="run"
                  type="number"
                  placeholder="e.g., 4.5"
                  value={run}
                  onChange={(e) => {
                    setRun(e.target.value);
                    setCalculated(false);
                  }}
                  step="0.01"
                  data-testid="input-run"
                />
                <p className="text-xs text-muted-foreground">Half the building width for gable roof</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rise">Rise - Vertical (m)</Label>
                <Input
                  id="rise"
                  type="number"
                  placeholder="e.g., 1.8"
                  value={rise}
                  onChange={(e) => {
                    setRise(e.target.value);
                    setCalculated(false);
                  }}
                  step="0.01"
                  data-testid="input-rise"
                />
                <p className="text-xs text-muted-foreground">Height from wall plate to ridge</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roofLength">Roof Length (m) - Optional</Label>
              <Input
                id="roofLength"
                type="number"
                placeholder="e.g., 12"
                value={roofLength}
                onChange={(e) => {
                  setRoofLength(e.target.value);
                  setCalculated(false);
                }}
                step="0.01"
                data-testid="input-roof-length"
              />
              <p className="text-xs text-muted-foreground">Enter to calculate total roof area (both sides)</p>
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
          title="Roof Pitch Results"
          results={[
            { label: "Pitch Angle", value: results.pitchAngle, unit: "°", highlight: true },
            { label: "Pitch Ratio", value: `${results.pitchRatio}:12`, highlight: true },
            { label: "Classification", value: getPitchDescription(parseFloat(results.pitchAngle)) },
            { label: "Raker Length", value: results.rakerLength, unit: "m" },
            ...(results.roofArea ? [{ label: "Total Roof Area", value: results.roofArea, unit: "m²", highlight: true }] : []),
          ]}
          quoteDescription={`Roof - ${results.pitchAngle}° pitch (${results.pitchRatio}:12 ratio)${results.roofArea ? `, ${results.roofArea}m² total area` : ''}, raker length ${results.rakerLength}m`}
          quoteQuantity={results.roofArea ? parseFloat(results.roofArea) : parseFloat(results.rakerLength)}
          quoteUnit={results.roofArea ? "m²" : "m"}
        />
      )}
    </div>
  );
}
