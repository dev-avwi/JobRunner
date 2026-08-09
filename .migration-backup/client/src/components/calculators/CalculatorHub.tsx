import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import {
  Calculator,
  Search,
  Ruler,
  Square,
  PaintBucket,
  Grid3X3,
  Home,
  Zap,
  Droplets,
  Wind,
  Wrench,
} from "lucide-react";
import BalusterSpacingCalc from "./BalusterSpacingCalc";
import ConcreteVolumeCalc from "./ConcreteVolumeCalc";
import TileQuantityCalc from "./TileQuantityCalc";
import PaintCoverageCalc from "./PaintCoverageCalc";
import RoofPitchCalc from "./RoofPitchCalc";

type TradeCategory = "all" | "building" | "electrical" | "plumbing" | "hvac" | "painting" | "tiling";

interface CalculatorInfo {
  id: string;
  name: string;
  description: string;
  icon: typeof Calculator;
  category: TradeCategory;
  component: React.ComponentType;
}

const calculators: CalculatorInfo[] = [
  {
    id: "baluster-spacing",
    name: "Baluster Spacing",
    description: "Calculate baluster count and gap spacing for decks and stair rails (AU compliant 100mm max)",
    icon: Ruler,
    category: "building",
    component: BalusterSpacingCalc,
  },
  {
    id: "concrete-volume",
    name: "Concrete Volume",
    description: "Calculate cubic meters and premix bags needed for slabs, footings, and pads",
    icon: Square,
    category: "building",
    component: ConcreteVolumeCalc,
  },
  {
    id: "tile-quantity",
    name: "Tile Quantity",
    description: "Calculate tile count with wastage for floors and walls",
    icon: Grid3X3,
    category: "tiling",
    component: TileQuantityCalc,
  },
  {
    id: "paint-coverage",
    name: "Paint Coverage",
    description: "Calculate paint needed for walls with door/window exclusions",
    icon: PaintBucket,
    category: "painting",
    component: PaintCoverageCalc,
  },
  {
    id: "roof-pitch",
    name: "Roof Pitch",
    description: "Calculate pitch angle, ratio, and roof area from rise and run measurements",
    icon: Home,
    category: "building",
    component: RoofPitchCalc,
  },
];

const categoryLabels: Record<TradeCategory, string> = {
  all: "All Calculators",
  building: "Building",
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC",
  painting: "Painting",
  tiling: "Tiling",
};

const categoryIcons: Record<TradeCategory, typeof Calculator> = {
  all: Calculator,
  building: Wrench,
  electrical: Zap,
  plumbing: Droplets,
  hvac: Wind,
  painting: PaintBucket,
  tiling: Grid3X3,
};

const categoryColors: Record<TradeCategory, string> = {
  all: "bg-muted text-foreground",
  building: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  electrical: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  plumbing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  hvac: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  painting: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  tiling: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export default function CalculatorHub() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TradeCategory>("all");
  const [activeCalculator, setActiveCalculator] = useState<string | null>(null);

  const filteredCalculators = useMemo(() => {
    return calculators.filter((calc) => {
      const matchesSearch = searchQuery === "" ||
        calc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        calc.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === "all" || calc.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const activeCalcInfo = calculators.find((c) => c.id === activeCalculator);

  if (activeCalcInfo) {
    const CalcComponent = activeCalcInfo.component;
    return (
      <PageShell data-testid="page-calculator-active">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setActiveCalculator(null)}
            data-testid="button-back-to-calculators"
          >
            Back to Calculators
          </Button>
        </div>
        <CalcComponent />
      </PageShell>
    );
  }

  return (
    <PageShell data-testid="page-calculator-hub">
      <PageHeader
        title="Trade Calculators"
        subtitle="Built-in calculations that link directly to your quotes"
        leading={<Calculator className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search calculators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-calculators"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as TradeCategory)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-category">
            <SelectValue placeholder="Filter by trade" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(categoryLabels) as TradeCategory[]).map((cat) => {
              const Icon = categoryIcons[cat];
              return (
                <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {categoryLabels[cat]}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {filteredCalculators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No calculators found matching your search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCalculators.map((calc) => {
            const Icon = calc.icon;
            return (
              <Card
                key={calc.id}
                className="hover-elevate active-elevate-2 cursor-pointer transition-200"
                onClick={() => setActiveCalculator(calc.id)}
                data-testid={`card-calculator-${calc.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                    </div>
                    <Badge variant="outline" className={categoryColors[calc.category]}>
                      {categoryLabels[calc.category]}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-3">{calc.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{calc.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
