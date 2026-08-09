import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Ruler, Info } from "lucide-react";
import CalculatorResult from "./CalculatorResult";

export default function BalusterSpacingCalc() {
  const [totalSpan, setTotalSpan] = useState("");
  const [maxGap, setMaxGap] = useState("100");
  const [balusterWidth, setBalusterWidth] = useState("40");
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const span = parseFloat(totalSpan);
    const gap = parseFloat(maxGap);
    const width = parseFloat(balusterWidth);

    if (!span || !gap || !width || span <= 0) {
      return null;
    }

    const numberOfGaps = Math.floor(span / (gap + width)) + 1;
    const numberOfBalusters = numberOfGaps - 1;
    const actualGap = (span - (numberOfBalusters * width)) / numberOfGaps;

    return {
      numberOfBalusters: Math.max(0, numberOfBalusters),
      numberOfGaps,
      actualGap: actualGap.toFixed(1),
      totalSpanUsed: span,
    };
  }, [totalSpan, maxGap, balusterWidth]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
    }
  };

  const handleReset = () => {
    setTotalSpan("");
    setMaxGap("100");
    setBalusterWidth("40");
    setCalculated(false);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-baluster-calculator">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Ruler className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <CardTitle>Baluster Spacing Calculator</CardTitle>
              <CardDescription>Calculate baluster count and gap spacing for decks and stair rails</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-blue-500/10 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Australian Building Code requires a maximum gap of 100mm between balusters to prevent children from passing through.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalSpan">Total Span (mm)</Label>
              <Input
                id="totalSpan"
                type="number"
                placeholder="e.g., 3000"
                value={totalSpan}
                onChange={(e) => {
                  setTotalSpan(e.target.value);
                  setCalculated(false);
                }}
                data-testid="input-total-span"
              />
              <p className="text-xs text-muted-foreground">Inside edge to inside edge</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxGap">Max Gap (mm)</Label>
              <Input
                id="maxGap"
                type="number"
                placeholder="100"
                value={maxGap}
                onChange={(e) => {
                  setMaxGap(e.target.value);
                  setCalculated(false);
                }}
                data-testid="input-max-gap"
              />
              <p className="text-xs text-muted-foreground">AU standard: 100mm</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="balusterWidth">Baluster Width (mm)</Label>
              <Input
                id="balusterWidth"
                type="number"
                placeholder="40"
                value={balusterWidth}
                onChange={(e) => {
                  setBalusterWidth(e.target.value);
                  setCalculated(false);
                }}
                data-testid="input-baluster-width"
              />
              <p className="text-xs text-muted-foreground">Width of each baluster</p>
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
          title="Baluster Calculation Results"
          results={[
            { label: "Number of Balusters", value: results.numberOfBalusters, highlight: true },
            { label: "Number of Gaps", value: results.numberOfGaps },
            { label: "Actual Gap", value: results.actualGap, unit: "mm" },
            { label: "Total Span", value: results.totalSpanUsed, unit: "mm" },
          ]}
          quoteDescription={`Balusters - ${results.numberOfBalusters} x ${balusterWidth}mm balusters for ${totalSpan}mm span (${results.actualGap}mm gaps, AU compliant)`}
          quoteQuantity={results.numberOfBalusters}
          quoteUnit="pcs"
        />
      )}
    </div>
  );
}
