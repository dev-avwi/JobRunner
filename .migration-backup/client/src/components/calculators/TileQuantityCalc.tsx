import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Grid3X3, Info } from "lucide-react";
import CalculatorResult from "./CalculatorResult";

const tileSizes = [
  { value: "300x300", label: "300 x 300mm", area: 0.09 },
  { value: "400x400", label: "400 x 400mm", area: 0.16 },
  { value: "450x450", label: "450 x 450mm", area: 0.2025 },
  { value: "600x600", label: "600 x 600mm", area: 0.36 },
  { value: "600x300", label: "600 x 300mm", area: 0.18 },
  { value: "800x800", label: "800 x 800mm", area: 0.64 },
  { value: "custom", label: "Custom Size", area: 0 },
];

export default function TileQuantityCalc() {
  const [roomLength, setRoomLength] = useState("");
  const [roomWidth, setRoomWidth] = useState("");
  const [tileSize, setTileSize] = useState("600x600");
  const [customTileLength, setCustomTileLength] = useState("");
  const [customTileWidth, setCustomTileWidth] = useState("");
  const [tilesPerBox, setTilesPerBox] = useState("4");
  const [wastagePercent, setWastagePercent] = useState(10);
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const length = parseFloat(roomLength);
    const width = parseFloat(roomWidth);
    const perBox = parseInt(tilesPerBox);

    if (!length || !width || length <= 0 || width <= 0 || !perBox || perBox <= 0) {
      return null;
    }

    let tileArea: number;
    let tileDimensions: string;

    if (tileSize === "custom") {
      const customL = parseFloat(customTileLength) / 1000;
      const customW = parseFloat(customTileWidth) / 1000;
      if (!customL || !customW || customL <= 0 || customW <= 0) return null;
      tileArea = customL * customW;
      tileDimensions = `${customTileLength}x${customTileWidth}mm`;
    } else {
      const selectedSize = tileSizes.find((s) => s.value === tileSize);
      if (!selectedSize) return null;
      tileArea = selectedSize.area;
      tileDimensions = selectedSize.label;
    }

    const roomArea = length * width;
    const baseTiles = Math.ceil(roomArea / tileArea);
    const wastageMultiplier = 1 + (wastagePercent / 100);
    const totalTiles = Math.ceil(baseTiles * wastageMultiplier);
    const boxesNeeded = Math.ceil(totalTiles / perBox);

    return {
      roomArea: roomArea.toFixed(2),
      baseTiles,
      totalTiles,
      boxesNeeded,
      wastageAmount: totalTiles - baseTiles,
      tileDimensions,
    };
  }, [roomLength, roomWidth, tileSize, customTileLength, customTileWidth, tilesPerBox, wastagePercent]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
    }
  };

  const handleReset = () => {
    setRoomLength("");
    setRoomWidth("");
    setTileSize("600x600");
    setCustomTileLength("");
    setCustomTileWidth("");
    setTilesPerBox("4");
    setWastagePercent(10);
    setCalculated(false);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-tile-calculator">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <Grid3X3 className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <CardTitle>Tile Quantity Calculator</CardTitle>
              <CardDescription>Calculate tile count with wastage for floors and walls</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-emerald-500/10 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Add 5-15% wastage for cuts, breakages, and pattern matching. Use higher wastage for diagonal patterns or complex layouts.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roomLength">Room Length (m)</Label>
                <Input
                  id="roomLength"
                  type="number"
                  placeholder="e.g., 5.5"
                  value={roomLength}
                  onChange={(e) => {
                    setRoomLength(e.target.value);
                    setCalculated(false);
                  }}
                  step="0.01"
                  data-testid="input-room-length"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomWidth">Room Width (m)</Label>
                <Input
                  id="roomWidth"
                  type="number"
                  placeholder="e.g., 4.0"
                  value={roomWidth}
                  onChange={(e) => {
                    setRoomWidth(e.target.value);
                    setCalculated(false);
                  }}
                  step="0.01"
                  data-testid="input-room-width"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tile Size</Label>
              <Select value={tileSize} onValueChange={(v) => { setTileSize(v); setCalculated(false); }}>
                <SelectTrigger data-testid="select-tile-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tileSizes.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tileSize === "custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customTileLength">Tile Length (mm)</Label>
                  <Input
                    id="customTileLength"
                    type="number"
                    placeholder="e.g., 600"
                    value={customTileLength}
                    onChange={(e) => {
                      setCustomTileLength(e.target.value);
                      setCalculated(false);
                    }}
                    data-testid="input-custom-length"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customTileWidth">Tile Width (mm)</Label>
                  <Input
                    id="customTileWidth"
                    type="number"
                    placeholder="e.g., 300"
                    value={customTileWidth}
                    onChange={(e) => {
                      setCustomTileWidth(e.target.value);
                      setCalculated(false);
                    }}
                    data-testid="input-custom-width"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tilesPerBox">Tiles Per Box</Label>
              <Input
                id="tilesPerBox"
                type="number"
                placeholder="4"
                value={tilesPerBox}
                onChange={(e) => {
                  setTilesPerBox(e.target.value);
                  setCalculated(false);
                }}
                data-testid="input-tiles-per-box"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Wastage Allowance</Label>
                <span className="text-sm font-medium">{wastagePercent}%</span>
              </div>
              <Slider
                value={[wastagePercent]}
                onValueChange={(v) => {
                  setWastagePercent(v[0]);
                  setCalculated(false);
                }}
                min={5}
                max={15}
                step={1}
                data-testid="slider-wastage"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5% (Simple layout)</span>
                <span>15% (Complex cuts)</span>
              </div>
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
          title="Tile Quantity Results"
          results={[
            { label: "Total Tiles", value: results.totalTiles, unit: "tiles", highlight: true },
            { label: "Boxes Needed", value: results.boxesNeeded, unit: "boxes", highlight: true },
            { label: "Room Area", value: results.roomArea, unit: "m²" },
            { label: "Base Tiles", value: results.baseTiles, unit: "tiles" },
            { label: "Wastage Tiles", value: results.wastageAmount, unit: `tiles (${wastagePercent}%)` },
          ]}
          quoteDescription={`Tiles - ${results.totalTiles} x ${results.tileDimensions} tiles (${results.boxesNeeded} boxes) for ${results.roomArea}m² incl. ${wastagePercent}% wastage`}
          quoteQuantity={results.boxesNeeded}
          quoteUnit="boxes"
        />
      )}
    </div>
  );
}
