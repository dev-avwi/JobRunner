import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Receipt,
  Settings,
  CheckCircle2,
  Plus,
  ArrowRight,
  LogOut,
  MoreHorizontal,
  Clock,
  Calendar,
  ShieldCheck,
  MessageSquare
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: any;
  targetSelector?: string;
  waitForClick?: boolean;
  clickTargetSelector?: string;
  clickTargetLabel?: string;
  mobileOnly?: boolean;
  desktopRoute?: string;
  // Free-interaction step: the page stays fully usable (e.g. filling a form).
  // The overlay does not dim or block the page; Next/Skip are always available.
  allowInteraction?: boolean;
  // When the app navigates to this route (e.g. after a successful save), advance.
  advanceOnRoute?: string;
  desktopAlternative?: {
    title: string;
    description: string;
    clickTargetSelector?: string;
    clickTargetLabel?: string;
  };
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to JobRunner",
    description: "Your business is set up — now let's get you ready to work. I'll help you add your first client, book a job, and send a quote. You can skip any step or leave the tour whenever you like.",
    route: "/",
    icon: Sparkles
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    description: "This is your home base — today's jobs, your earnings summary, and quick actions all live here. Everything starts from this screen.",
    route: "/",
    icon: LayoutDashboard,
    targetSelector: '[data-testid="dashboard-content"], main, .dashboard-container'
  },

  // ---------------- Clients ----------------
  {
    id: "nav-clients",
    title: "Open the More Menu",
    description: "On mobile, some areas live in the 'More' menu. Tap 'More' at the bottom to find Clients.",
    route: "/",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More",
    mobileOnly: true,
    desktopAlternative: {
      title: "Go to Clients",
      description: "Click 'Clients' in the sidebar to open your customer list.",
      clickTargetSelector: '[data-testid="sidebar-clients"], a[href="/clients"]',
      clickTargetLabel: "Clients"
    }
  },
  {
    id: "nav-clients-mobile",
    title: "Go to Clients",
    description: "Now tap 'Clients' to open your customer list.",
    route: "/more",
    icon: Users,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-clients"], [data-testid="nav-clients"], a[href="/clients"]',
    clickTargetLabel: "Clients",
    mobileOnly: true
  },
  {
    id: "clients-page",
    title: "Your Client List",
    description: "All your customers live here. We've added a few samples so you can see how it looks — now let's add your first real one.",
    route: "/clients",
    icon: Users,
    targetSelector: '[data-testid="clients-content"], [data-testid="clients-list"], main'
  },
  {
    id: "clients-add",
    title: "Add a Client",
    description: "See the '+ New Client' button? That's how you add a customer. Give it a click to open the form.",
    route: "/clients",
    icon: Plus,
    waitForClick: true,
    clickTargetSelector: '[data-testid="button-create-client"]',
    clickTargetLabel: "+ New Client"
  },
  {
    id: "client-form",
    title: "Fill in Their Details",
    description: "Pop in your client's name and contact details, then tap Save. Not ready yet? Hit Skip and add them later — nothing's locked in.",
    route: "/clients/new",
    icon: Users,
    allowInteraction: true,
    targetSelector: '[data-testid="page-client-form"], main',
    advanceOnRoute: "/clients"
  },

  // ---------------- Jobs ----------------
  {
    id: "nav-work",
    title: "Now Your Jobs",
    description: "Tap 'Work' at the bottom to see how jobs are managed.",
    route: "/clients",
    icon: Briefcase,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-work"], [data-testid="nav-work"], a[href="/work"]',
    clickTargetLabel: "Work",
    mobileOnly: true,
    desktopAlternative: {
      title: "Now Your Jobs",
      description: "Click 'Work' in the sidebar to open your job board.",
      clickTargetSelector: '[data-testid="sidebar-work"]',
      clickTargetLabel: "Work"
    }
  },
  {
    id: "jobs-page",
    title: "Your Job Board",
    description: "Jobs move through stages: Pending → Scheduled → In Progress → Done. We've added sample jobs so you can see the flow — now let's book one of your own.",
    route: "/work",
    icon: Briefcase,
    targetSelector: '[data-testid="work-content"], [data-testid="jobs-list"], main'
  },
  {
    id: "jobs-add",
    title: "Book a Job",
    description: "Click '+ New Job' to create one.",
    route: "/work",
    icon: Plus,
    waitForClick: true,
    clickTargetSelector: '[data-testid="button-create-job"]',
    clickTargetLabel: "+ New Job"
  },
  {
    id: "job-form",
    title: "Set Up the Job",
    description: "Give it a title, pick the client you just added, and set a date. Tap Save when you're ready — or Skip to do it later.",
    route: "/jobs/new",
    icon: Briefcase,
    allowInteraction: true,
    targetSelector: 'main',
    advanceOnRoute: "/work"
  },
  {
    id: "job-assign",
    title: "Putting Workers on Jobs",
    description: "Got a team? Open any job and use Assign to put a worker on it — or drag it onto the Schedule. You can change who's on a job anytime.",
    route: "/work",
    icon: Users,
    targetSelector: '[data-testid="work-content"], [data-testid="jobs-list"], main'
  },

  // ---------------- Documents (quotes & invoices) ----------------
  {
    id: "nav-docs",
    title: "Back to More",
    description: "Tap 'More' again to find your quotes and invoices.",
    route: "/work",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More",
    mobileOnly: true,
    desktopAlternative: {
      title: "Quotes & Invoices",
      description: "Click 'Documents' in the sidebar to open your quotes and invoices.",
      clickTargetSelector: '[data-testid="sidebar-documents"]',
      clickTargetLabel: "Documents"
    }
  },
  {
    id: "nav-quotes-mobile",
    title: "Open Quotes",
    description: "Tap 'Quotes' to see how you bill your clients.",
    route: "/more",
    icon: FileText,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-quotes"], [data-testid="nav-quotes"], a[href="/quotes"]',
    clickTargetLabel: "Quotes",
    mobileOnly: true
  },
  {
    id: "documents-page",
    title: "Quotes & Invoices",
    description: "This is where you create quotes and turn them into invoices — GST is worked out for you. We've added samples to explore. Now let's make a quote.",
    route: "/quotes",
    desktopRoute: "/documents",
    icon: FileText,
    targetSelector: '[data-testid="quotes-content"], [data-testid="quotes-list"], main'
  },
  {
    id: "quotes-add",
    title: "Create a Quote",
    description: "Click '+ New Quote' to start one.",
    route: "/documents?tab=quotes",
    icon: Plus,
    waitForClick: true,
    clickTargetSelector: '[data-testid="button-create-quote"]',
    clickTargetLabel: "+ New Quote"
  },
  {
    id: "quote-form",
    title: "Build Your Quote",
    description: "Add your line items and price — GST is calculated automatically. Save it, or Skip for now. When a client accepts, you can turn it into an invoice in one click.",
    route: "/quotes/new",
    icon: FileText,
    allowInteraction: true,
    targetSelector: 'main'
  },

  // ---------------- Settings ----------------
  {
    id: "nav-settings",
    title: "Last Stop: Settings",
    description: "Tap 'More' to find Settings.",
    route: "/quotes",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More",
    mobileOnly: true,
    desktopAlternative: {
      title: "Last Stop: Settings",
      description: "Click 'Settings' in the sidebar to set up your business profile.",
      clickTargetSelector: '[data-testid="sidebar-settings"], a[href="/settings"]',
      clickTargetLabel: "Settings"
    }
  },
  {
    id: "nav-settings-mobile",
    title: "Open Settings",
    description: "Tap 'Settings' to set up your business profile.",
    route: "/more",
    icon: Settings,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-settings"], [data-testid="nav-settings"], a[href="/settings"]',
    clickTargetLabel: "Settings",
    mobileOnly: true
  },
  {
    id: "settings-page",
    title: "Your Business Hub",
    description: "Everything about your business lives here — your logo, ABN, GST, payments and email templates. Let's set up the important bits.",
    route: "/settings",
    icon: Settings,
    targetSelector: '[data-testid="settings-content"], [data-testid="settings-tabs"], main'
  },
  {
    id: "settings-branding",
    title: "Add Your Logo",
    description: "Open the 'Branding' tab to upload your logo — it shows on every quote and invoice you send, so your business looks the part. Tap Next when you've had a look.",
    route: "/settings",
    icon: Settings,
    allowInteraction: true,
    targetSelector: '[data-testid="tab-branding"], [data-testid="settings-tabs"], main'
  },
  {
    id: "settings-business",
    title: "Business & GST",
    description: "In the 'Business' tab, add your ABN and switch on GST so your invoices are spot on for the ATO.",
    route: "/settings",
    icon: Settings,
    allowInteraction: true,
    targetSelector: '[data-testid="tab-business"], [data-testid="settings-tabs"], main'
  },

  {
    id: "complete",
    title: "You're Ready to Go",
    description: "Nice work! You've set up a client, a job and a quote, and sorted your business details. Add your first real client whenever you're ready — you can replay this tour anytime from Settings.",
    route: "/",
    icon: CheckCircle2
  }
];

// Worker tour — for team members who work on jobs but don't manage clients,
// quotes, invoices or business settings. These are informational steps that
// auto-navigate to each page; the user taps Next to move on. We deliberately
// avoid "click Clients" style steps because workers don't have those pages.
const WORKER_TOUR_STEPS: TourStep[] = [
  {
    id: "w-welcome",
    title: "Welcome to JobRunner",
    description: "This is your work hub. I'll show you where to find your jobs, log your hours, track expenses and stay safe on site. Skip any step or leave the tour whenever you like.",
    route: "/",
    icon: Sparkles
  },
  {
    id: "w-dashboard",
    title: "Your Dashboard",
    description: "Your day at a glance — today's jobs, hours logged, and quick actions. Everything starts from this screen.",
    route: "/",
    icon: LayoutDashboard,
    targetSelector: '[data-testid="dashboard-content"], main, .dashboard-container'
  },
  {
    id: "w-work",
    title: "Your Jobs",
    description: "Every job you're put on shows up here. Tap one to see the address, what needs doing, and any notes from the boss.",
    route: "/work",
    icon: Briefcase,
    targetSelector: '[data-testid="work-content"], [data-testid="jobs-list"], main'
  },
  {
    id: "w-time",
    title: "Track Your Hours",
    description: "Clock on and off here so your hours are recorded against the right job. No more paper timesheets.",
    route: "/time-tracking",
    icon: Clock,
    targetSelector: 'main'
  },
  {
    id: "w-expenses",
    title: "Log Expenses",
    description: "Bought materials or fuel for a job? Snap the receipt here and it's tracked against the job — nothing gets lost.",
    route: "/expenses",
    icon: Receipt,
    targetSelector: 'main'
  },
  {
    id: "w-schedule",
    title: "Your Schedule",
    description: "See what's booked in and where you need to be. All your upcoming jobs in one calendar.",
    route: "/schedule",
    icon: Calendar,
    targetSelector: 'main'
  },
  {
    id: "w-safety",
    title: "Stay Safe on Site",
    description: "Fill in safety forms and sign off SWMS before you start. Keeps you and the team compliant.",
    route: "/whs",
    icon: ShieldCheck,
    targetSelector: 'main'
  },
  {
    id: "w-chat",
    title: "Talk to the Team",
    description: "Message the boss and your workmates, share photos from site, and stay in the loop — all in one place.",
    route: "/chat",
    icon: MessageSquare,
    targetSelector: 'main'
  },
  {
    id: "w-complete",
    title: "You're All Set",
    description: "That's the basics. Jump into your jobs, log your hours, and you're good to go. You can replay this tour anytime from Settings.",
    route: "/",
    icon: CheckCircle2
  }
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  // Which step set to run. Workers get a job-focused tour with no clients,
  // quotes, invoices or business-settings steps (they can't access those).
  audience?: 'owner' | 'worker';
}

type CardPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export default function GuidedTour({ isOpen, onClose, onComplete, audience = 'owner' }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<CardPosition>('center');
  const [isReady, setIsReady] = useState(false);
  const [location, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Tracks whether a free-form step has actually landed on its own route yet,
  // so advanceOnRoute can't fire prematurely on step entry.
  const freeFormReadyRef = useRef(false);

  // Filter out mobile-only steps on desktop (>= 768px)
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pick the step set for this audience (workers get a job-focused tour).
  const baseSteps = audience === 'worker' ? WORKER_TOUR_STEPS : TOUR_STEPS;

  // Transform steps based on screen size - apply desktop alternatives for mobile-only steps (memoized for stability)
  const filteredSteps = useMemo(() =>
    baseSteps.map(s => {
      if (s.mobileOnly && !isMobileView && s.desktopAlternative) {
        return {
          ...s,
          title: s.desktopAlternative.title,
          description: s.desktopAlternative.description,
          clickTargetSelector: s.desktopAlternative.clickTargetSelector || s.clickTargetSelector,
          clickTargetLabel: s.desktopAlternative.clickTargetLabel || s.clickTargetLabel,
          mobileOnly: false
        };
      }
      if (!s.mobileOnly && !isMobileView && s.desktopAlternative) {
        return {
          ...s,
          title: s.desktopAlternative.title,
          description: s.desktopAlternative.description,
          clickTargetSelector: s.desktopAlternative.clickTargetSelector || s.clickTargetSelector,
          clickTargetLabel: s.desktopAlternative.clickTargetLabel || s.clickTargetLabel,
        };
      }
      return s;
    }).filter(s => !s.mobileOnly || isMobileView),
    [isMobileView, baseSteps]
  );

  // Guard currentStep to stay within bounds when filteredSteps changes
  const safeCurrentStep = Math.min(currentStep, filteredSteps.length - 1);
  const step = filteredSteps[safeCurrentStep];
  const isLastStep = safeCurrentStep === filteredSteps.length - 1;
  const isFirstStep = safeCurrentStep === 0;
  const isInteractive = step.waitForClick && step.clickTargetSelector;
  const isFreeForm = !!step.allowInteraction;
  const StepIcon = step.icon;

  // Reset the free-form "entered own route" gate whenever the step changes.
  useEffect(() => {
    freeFormReadyRef.current = false;
  }, [safeCurrentStep]);

  // Find element by trying multiple selectors
  const findElement = useCallback((selectorString: string): Element | null => {
    const selectors = selectorString.split(', ');
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector.trim());
        if (el) return el;
      } catch (e) {
        // Invalid selector
      }
    }
    return null;
  }, []);

  const scrollToElement = useCallback((element: Element): Promise<void> => {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect();
      const headerOffset = 80;
      const viewportHeight = window.innerHeight;

      const sidebarContent = element.closest('[data-sidebar="content"]');
      if (sidebarContent) {
        const sidebarRect = sidebarContent.getBoundingClientRect();
        const elementRelativeTop = rect.top - sidebarRect.top + sidebarContent.scrollTop;
        const targetScroll = elementRelativeTop - sidebarRect.height / 2 + rect.height / 2;
        sidebarContent.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
        setTimeout(resolve, 400);
        return;
      }

      const isVisible = rect.top >= headerOffset && rect.bottom <= viewportHeight - 100;
      if (!isVisible) {
        const scrollTop = window.scrollY + rect.top - headerOffset - 50;
        window.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
        setTimeout(resolve, 400);
      } else {
        resolve();
      }
    });
  }, []);

  // Calculate best position for the tour card relative to target
  const calculateCardPosition = useCallback((rect: DOMRect): CardPosition => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardHeight = 280;
    const cardWidth = Math.min(380, viewportWidth - 32);
    const padding = 20;

    const spaceAbove = rect.top - 80;
    const spaceBelow = viewportHeight - rect.bottom - 20;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    if (viewportWidth < 640) {
      return spaceBelow > cardHeight + padding ? 'bottom' : 'top';
    }

    if (rect.left < 300 && spaceRight > cardWidth + padding) return 'right';

    if (spaceBelow > cardHeight + padding) return 'bottom';
    if (spaceAbove > cardHeight + padding) return 'top';
    if (spaceRight > cardWidth + padding) return 'right';
    if (spaceLeft > cardWidth + padding) return 'left';

    return 'bottom';
  }, []);

  // Measure and set up target
  const setupTarget = useCallback(async () => {
    const selector = isInteractive ? step.clickTargetSelector : step.targetSelector;

    if (!selector) {
      setTargetRect(null);
      setCardPosition('center');
      setIsReady(true);
      return;
    }

    const element = findElement(selector);
    if (!element) {
      setTargetRect(null);
      setCardPosition('center');
      setIsReady(true);
      return;
    }

    // Scroll to element first
    await scrollToElement(element);

    // Now measure the element
    const rect = element.getBoundingClientRect();
    setTargetRect(rect);
    setCardPosition(calculateCardPosition(rect));
    setIsReady(true);
  }, [step, isInteractive, findElement, scrollToElement, calculateCardPosition]);

  // Handle step navigation
  useEffect(() => {
    if (!isOpen) return;

    const navigateToStep = async () => {
      setIsTransitioning(true);
      setIsReady(false);
      setTargetRect(null);

      const currentPath = window.location.pathname;
      const targetRoute = (!isMobileView && step.desktopRoute) ? step.desktopRoute : step.route;
      const targetPath = targetRoute.split('?')[0];
      if (targetPath !== currentPath) {
        setLocation(targetRoute);
        window.scrollTo({ top: 0 });
        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.scrollTop = 0;
        await new Promise(r => setTimeout(r, 500));
      }

      // Set up target after navigation
      await setupTarget();
      setIsTransitioning(false);
    };

    navigateToStep();
  }, [currentStep, isOpen, step.route, step.desktopRoute, isMobileView, setLocation, setupTarget]);

  // Draw overlay with spotlight
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // On free-interaction steps we keep the page fully visible & usable, so
    // we skip the dark dim and the spotlight cut-out — just draw a soft ring.
    if (!isFreeForm) {
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);
    }

    if (targetRect && isReady) {
      const padding = 12;
      const radius = 12;
      const x = targetRect.left - padding;
      const y = targetRect.top - padding;
      const w = targetRect.width + padding * 2;
      const h = targetRect.height + padding * 2;

      if (!isFreeForm) {
        // Clear the spotlight area
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      const borderColor = isInteractive ? 'rgba(16, 185, 129, 0.6)' : 'rgba(59, 130, 246, 0.5)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [targetRect, isReady, isInteractive, isFreeForm]);

  // Redraw on changes
  useEffect(() => {
    if (isOpen) {
      drawOverlay();
    }
  }, [isOpen, targetRect, isReady, drawOverlay]);

  // Handle resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setupTarget();
      drawOverlay();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, setupTarget, drawOverlay]);

  // Advance navigation (interactive) steps when the app actually routes to the next
  // step's page. This is the SINGLE source of truth for interactive advances — there
  // is deliberately no click listener, which removes the old double-advance bug where
  // both a click handler and a route effect fired for one navigation (skipping steps).
  // The "Done" button is the manual fallback if a target can't be found/clicked.
  useEffect(() => {
    if (!isOpen || !isInteractive) return;

    const nextStep = filteredSteps[safeCurrentStep + 1];
    if (!nextStep) return;

    const resolvePath = (s: TourStep) =>
      ((!isMobileView && s.desktopRoute) ? s.desktopRoute : s.route).split('?')[0];
    const nextPath = resolvePath(nextStep);
    const ownPath = resolvePath(step);

    if (location === nextPath && ownPath !== nextPath) {
      setCurrentStep(prev => Math.min(prev + 1, filteredSteps.length - 1));
    }
  }, [isOpen, isInteractive, location, safeCurrentStep, step, isMobileView, filteredSteps]);

  // For free-interaction form steps: only AFTER we've actually landed on the form's
  // own route do we watch for advanceOnRoute (e.g. the user saved and was returned to
  // the list). The "landed first" gate prevents a premature skip on step entry.
  useEffect(() => {
    if (!isOpen || !isFreeForm || !step.advanceOnRoute) return;

    const ownPath = ((!isMobileView && step.desktopRoute) ? step.desktopRoute : step.route).split('?')[0];
    if (location === ownPath) {
      freeFormReadyRef.current = true;
      return;
    }
    if (freeFormReadyRef.current && location === step.advanceOnRoute) {
      setCurrentStep(prev => Math.min(prev + 1, filteredSteps.length - 1));
    }
  }, [isOpen, isFreeForm, step.advanceOnRoute, step.route, step.desktopRoute, isMobileView, location, filteredSteps.length]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset on open and set body attribute for other components to know tour is active
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      document.body.setAttribute('data-tour-active', 'true');
    } else {
      document.body.removeAttribute('data-tour-active');
    }

    return () => {
      document.body.removeAttribute('data-tour-active');
    };
  }, [isOpen]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      const prevIdx = safeCurrentStep - 1;
      const prevStep = filteredSteps[prevIdx];
      if (prevStep) {
        const targetRoute = (!isMobileView && prevStep.desktopRoute) ? prevStep.desktopRoute : prevStep.route;
        const targetPath = targetRoute.split('?')[0];
        const currentPath = window.location.pathname;
        if (targetPath !== currentPath) {
          setLocation(targetRoute);
        }
      }
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("jobrunner-tour-completed", "true");
    localStorage.setItem("jobrunner-tour-completed-date", new Date().toISOString());
    onComplete();
  };

  const handleExit = () => {
    localStorage.setItem("jobrunner-tour-skipped", "true");
    onClose();
  };

  const handleSkipStep = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (!isOpen) return null;

  // Check if a proposed card rect overlaps the target spotlight area
  const wouldOverlapTarget = (cardLeft: number, cardTop: number, cardW: number, cardH: number, target: DOMRect): boolean => {
    const spotPad = 20;
    const tLeft = target.left - spotPad;
    const tRight = target.right + spotPad;
    const tTop = target.top - spotPad;
    const tBottom = target.bottom + spotPad;
    const cRight = cardLeft + cardW;
    const cBottom = cardTop + cardH;
    return !(cardLeft >= tRight || cRight <= tLeft || cardTop >= tBottom || cBottom <= tTop);
  };

  // Calculate card style based on position
  const getCardStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 640;
    const cardWidthPx = isMobile ? window.innerWidth - 32 : 380;
    const cardWidthStr = isMobile ? 'calc(100vw - 32px)' : '380px';

    const base: React.CSSProperties = {
      position: 'fixed',
      width: cardWidthStr,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 10001,
      pointerEvents: 'auto'
    };

    if (isMobile) {
      return {
        ...base,
        left: '16px',
        right: '16px',
        top: '80px',
        width: 'auto',
        maxHeight: '50vh',
        overflowY: 'auto'
      };
    }

    if (!targetRect || cardPosition === 'center') {
      return {
        ...base,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const gap = 20;
    const cardH = 350;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const tryPosition = (pos: CardPosition): React.CSSProperties | null => {
      let left: number;
      let top: number;
      switch (pos) {
        case 'bottom':
          left = Math.max(16, Math.min(targetRect.left, vw - cardWidthPx - 16));
          top = Math.max(80, Math.min(targetRect.bottom + gap, vh - cardH - 20));
          break;
        case 'top':
          left = Math.max(16, Math.min(targetRect.left, vw - cardWidthPx - 16));
          top = Math.max(80, targetRect.top - cardH - gap);
          break;
        case 'right':
          left = Math.min(targetRect.right + gap, vw - cardWidthPx - 16);
          top = Math.max(80, Math.min(targetRect.top, vh - cardH - 20));
          break;
        case 'left':
          left = Math.max(16, targetRect.left - cardWidthPx - gap);
          top = Math.max(80, Math.min(targetRect.top, vh - cardH - 20));
          break;
        default:
          return null;
      }
      if (isInteractive && wouldOverlapTarget(left, top, cardWidthPx, cardH, targetRect)) {
        return null;
      }
      return { ...base, left, top };
    };

    const preferred = tryPosition(cardPosition);
    if (preferred) return preferred;

    const fallbacks: CardPosition[] = ['bottom', 'right', 'top', 'left'];
    for (const pos of fallbacks) {
      if (pos === cardPosition) continue;
      const result = tryPosition(pos);
      if (result) return result;
    }

    return {
      ...base,
      right: 16,
      bottom: 20
    };
  };

  const renderArrow = () => {
    if (!targetRect || !isReady || cardPosition === 'center') return null;
    if (!isInteractive) return null;

    const arrowColor = 'rgba(16, 185, 129, 0.85)';
    const isLeftSide = targetRect.left < 300;

    if (isLeftSide) {
      return (
        <div
          className="fixed pointer-events-none z-[10002]"
          style={{
            left: targetRect.right + 8,
            top: targetRect.top + targetRect.height / 2 - 16
          }}
        >
          <div className="flex items-center animate-pulse">
            <div
              className="w-0 h-0 border-t-[6px] border-b-[6px] border-r-[6px] border-transparent"
              style={{ borderRightColor: arrowColor }}
            />
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-xs font-medium shadow-md whitespace-nowrap"
              style={{ backgroundColor: arrowColor }}
            >
              Click "{step.clickTargetLabel}"
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed pointer-events-none z-[10002]"
        style={{
          left: targetRect.left + targetRect.width / 2 - 20,
          top: targetRect.top - 38
        }}
      >
        <div className="flex flex-col items-center animate-pulse">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-xs font-medium shadow-md whitespace-nowrap"
            style={{ backgroundColor: arrowColor }}
          >
            Click "{step.clickTargetLabel}"
          </div>
          <div
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent mt-[-1px]"
            style={{ borderTopColor: arrowColor }}
          />
        </div>
      </div>
    );
  };

  // The overlay should let the page through when the user needs to click a real
  // target (interactive) or fill a form (free-interaction). Otherwise it captures
  // clicks so tapping outside the card exits the tour.
  const overlayPassThrough = (isInteractive && isReady) || isFreeForm;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: overlayPassThrough ? 'none' : 'auto' }}
      onClick={overlayPassThrough ? undefined : handleExit}
      data-testid="guided-tour-overlay"
    >
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Arrow/indicator pointing to target */}
      {renderArrow()}

      {/* Tour Card */}
      <Card
        ref={cardRef}
        className="shadow-xl border overflow-hidden bg-background"
        style={{
          ...getCardStyle(),
          borderColor: isInteractive ? 'rgba(16, 185, 129, 0.4)' : 'hsl(var(--border))'
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="tour-tooltip"
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b bg-muted/50"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="p-2 rounded-lg flex-shrink-0 bg-muted"
              >
                <StepIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">
                  Step {safeCurrentStep + 1} of {filteredSteps.length}
                </p>
                <h3 className="font-semibold text-base truncate">{step.title}</h3>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleExit}
              data-testid="button-close-tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Interactive action prompt */}
          {isInteractive && isReady && (
            <div className="flex items-center gap-2 p-2.5 rounded-md mb-4 bg-muted">
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Click <strong className="text-foreground">"{step.clickTargetLabel}"</strong> to continue
              </span>
            </div>
          )}

          {/* Free-interaction prompt */}
          {isFreeForm && isReady && (
            <div className="flex items-center gap-2 p-2.5 rounded-md mb-4 bg-muted">
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Take your time — tap <strong className="text-foreground">Next</strong> when you're done, or <strong className="text-foreground">Skip</strong> to do it later.
              </span>
            </div>
          )}

          {/* Loading state */}
          {isTransitioning && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Step progress dots */}
          <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
            {filteredSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-200 ${
                  index === safeCurrentStep
                    ? "w-4 bg-primary"
                    : index < safeCurrentStep
                    ? "w-2 bg-primary/40"
                    : "w-2 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={isFirstStep || isTransitioning}
              className="text-muted-foreground"
              data-testid="button-tour-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {/* Skip this step (for interactive & form steps) */}
              {(isInteractive || isFreeForm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipStep}
                  className="text-muted-foreground text-xs"
                  data-testid="button-skip-step"
                >
                  Skip step
                </Button>
              )}

              {/* Done button - fallback for interactive steps when click detection fails */}
              {isInteractive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  data-testid="button-done-step"
                >
                  Done
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {/* Next button (hidden during forced-click interactive steps) */}
              {!isInteractive && (
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={isTransitioning}
                  data-testid="button-tour-next"
                >
                  {isTransitioning ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isLastStep ? (
                    <>
                      Finish
                      <Sparkles className="h-4 w-4 ml-1.5" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Exit tour link */}
          <div className="flex justify-center mt-3 pt-3 border-t">
            <button
              onClick={handleExit}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              data-testid="button-exit-tour"
            >
              <LogOut className="h-3 w-3" />
              Exit tour (press Esc)
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function useGuidedTour() {
  const [showTour, setShowTour] = useState(false);

  const hasCompleted = useCallback(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem("jobrunner-tour-completed") === "true" ||
           localStorage.getItem("jobrunner-tour-skipped") === "true";
  }, []);

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const closeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const completeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem("jobrunner-tour-completed");
    localStorage.removeItem("jobrunner-tour-completed-date");
    localStorage.removeItem("jobrunner-tour-skipped");
  }, []);

  return {
    showTour,
    hasCompleted,
    startTour,
    closeTour,
    completeTour,
    resetTour
  };
}

export function TourTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2"
      data-testid="button-start-tour"
    >
      <Sparkles className="h-4 w-4" />
      Start App Tour
    </Button>
  );
}
