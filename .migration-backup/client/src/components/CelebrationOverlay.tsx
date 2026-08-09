import { useEffect, useRef, useState } from "react";
import { PartyPopper, CheckCircle2, DollarSign, type LucideIcon } from "lucide-react";
import { onCelebrate, type CelebrationType } from "@/lib/celebrate";

interface CelebrationConfig {
  icon: LucideIcon;
  label: string;
  color: string; // HSL token (no wrapper) used for icon + confetti
}

const CONFIG: Record<CelebrationType, CelebrationConfig> = {
  invoice_paid: { icon: DollarSign, label: "Paid!", color: "var(--trade, 142 71% 45%)" },
  quote_accepted: { icon: CheckCircle2, label: "Quote accepted!", color: "var(--primary)" },
  job_completed: { icon: PartyPopper, label: "Job done!", color: "var(--trade, 142 71% 45%)" },
};

const CONFETTI_COLORS = [
  "var(--trade, 142 71% 45%)",
  "var(--primary)",
  "38 92% 50%",
  "270 70% 60%",
];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

interface ConfettiPiece {
  x: number;
  y: number;
  r: number;
  delay: number;
  duration: number;
  color: string;
}

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (Math.PI * (i / 15)) - Math.PI / 2; // fan upward then fall
    const spread = 120 + Math.random() * 80;
    return {
      x: Math.cos(angle) * spread + (Math.random() * 40 - 20),
      y: 120 + Math.random() * 160,
      r: Math.random() * 540 - 270,
      delay: Math.random() * 120,
      duration: 900 + Math.random() * 500,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    };
  });
}

export default function CelebrationOverlay() {
  const [active, setActive] = useState<{ type: CelebrationType; key: number } | null>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const keyRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onCelebrate(({ type }) => {
      if (!CONFIG[type]) return;
      const reduced = prefersReducedMotion();
      keyRef.current += 1;
      setConfetti(reduced ? [] : buildConfetti());
      setActive({ type, key: keyRef.current });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActive(null), reduced ? 1100 : 1500);
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;

  const { icon: Icon, label, color } = CONFIG[active.type];

  return (
    <div
      key={active.key}
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      aria-live="polite"
      data-testid="celebration-overlay"
    >
      <div className="relative flex flex-col items-center">
        {/* Confetti burst */}
        {confetti.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              backgroundColor: `hsl(${p.color})`,
              ["--confetti-x" as any]: `${p.x}px`,
              ["--confetti-y" as any]: `${p.y}px`,
              ["--confetti-r" as any]: `${p.r}deg`,
              ["--confetti-duration" as any]: `${p.duration}ms`,
              animationDelay: `${p.delay}ms`,
            }}
          />
        ))}

        {/* Center badge */}
        <div className="animate-celebrate-pop flex flex-col items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{
              width: 88,
              height: 88,
              backgroundColor: `hsl(${color} / 0.12)`,
            }}
          >
            <Icon className="h-11 w-11" style={{ color: `hsl(${color})` }} />
          </div>
          <span
            className="text-base font-semibold px-3 py-1 rounded-full bg-background/90 shadow-sm"
            style={{ color: `hsl(${color})` }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
