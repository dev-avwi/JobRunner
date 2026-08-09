import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LandingShell } from "@/components/LandingShell";
import { trackEvent } from "@/lib/analytics";

// Custom hook for scroll-triggered animations
function useScrollAnimation(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px', ...options }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// Animated section wrapper component
function AnimatedSection({ 
  children, 
  className = "", 
  animation = "fade-up",
  delay = 0 
}: { 
  children: React.ReactNode; 
  className?: string; 
  animation?: "fade-up" | "fade-left" | "fade-right" | "scale";
  delay?: number;
}) {
  const { ref, isVisible } = useScrollAnimation();
  
  const animationClass = {
    "fade-up": "scroll-fade-up",
    "fade-left": "scroll-fade-left", 
    "fade-right": "scroll-fade-right",
    "scale": "scroll-scale"
  }[animation];

  return (
    <div 
      ref={ref}
      className={`${animationClass} ${isVisible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

import { 
  Menu, 
  X,
  Calendar,
  MapPin,
  FileText,
  CreditCard,
  Users,
  Check,
  ChevronRight,
  Smartphone,
  ArrowRight,
  Play,
  Sparkles,
  Download,
  Globe,
  Monitor,
  Phone,
  Bot,
  Headphones
} from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";

import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";

// App screenshots for phone mockups
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import scheduleScreenshot from "@assets/appstore_screenshots/04_schedule.png";
import jobMapScreenshot from "@assets/appstore_screenshots/05_job_map.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

// Construction-themed environmental mockups for toggle section
import macbookMockup from "@assets/mockuuups-construction-themed-macbook-pro-mockup_(1)_1772460087144.jpeg";
import iphoneMockup from "@assets/mockuuups-construction-project-with-an-iphone-15-pro-mockup_(_1772460073460.jpeg";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAppPopup, setShowAppPopup] = useState(false);
  const [mockupMode, setMockupMode] = useState<'mobile' | 'web'>('mobile');
  const [betaStatus, setBetaStatus] = useState<{ spotsRemaining: number; maxLifetimeSpots: number } | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    fetch('/api/early-access/status')
      .then(res => res.json())
      .then(data => setBetaStatus(data))
      .catch(() => {});
  }, []);

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        if (data.sessionToken) {
          localStorage.setItem('sessionToken', data.sessionToken);
        }
        window.location.href = '/';
      }
    } catch {
    } finally {
      setIsDemoLoading(false);
    }
  };

  // Show mobile app popup after a short delay on first visit
  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('jobrunner_app_popup_dismissed');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setShowAppPopup(true);
      }, 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }
    return;
  }, []);

  const dismissAppPopup = () => {
    setShowAppPopup(false);
    localStorage.setItem('jobrunner_app_popup_dismissed', 'true');
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Custom smooth scroll with easing for better UX
  const smoothScrollTo = useCallback((targetY: number, duration: number = 800) => {
    const startY = window.pageYOffset;
    const difference = targetY - startY;
    const startTime = performance.now();
    
    // Easing function: easeInOutCubic for smooth acceleration/deceleration
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    
    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      window.scrollTo(0, startY + difference * easedProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  }, []);

  const scrollToTop = () => {
    smoothScrollTo(0, 600);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 64; // Account for fixed header (h-14 = 56px, lg:h-16 = 64px)
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      smoothScrollTo(elementPosition - offset, 800);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" 
          : "bg-white/80 backdrop-blur-sm"
      }`}>
        <LandingShell>
          <div className="flex items-center justify-between h-14 lg:h-16">
            {/* Logo */}
            <button 
              onClick={scrollToTop}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" 
              data-testid="nav-logo"
            >
              <img 
                src={jobrunnerLogo} 
                alt=""
                fetchPriority="high"
                decoding="async"
                width="32"
                height="32"
                className="h-8 w-auto"
              />
              <span className="text-2xl font-bold tracking-tight"><span className="text-brand">Job</span><span className="text-brand-accent">Runner</span></span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-7">
              <a 
                href="#features" 
                onClick={(e) => scrollToSection(e, "features")}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-features"
              >
                Features
              </a>
              <a 
                href="#how-it-works" 
                onClick={(e) => scrollToSection(e, "how-it-works")}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-how-it-works"
              >
                How It Works
              </a>
              <a 
                href="#pricing" 
                onClick={(e) => scrollToSection(e, "pricing")}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-pricing"
              >
                Pricing
              </a>
              <a 
                href="#download" 
                onClick={(e) => scrollToSection(e, "download")}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-download"
              >
                Download
              </a>
              <Link href="/portal" className="text-sm text-brand hover:text-brand/80 font-medium transition-colors" data-testid="nav-client-portal">
                Client Portal
              </Link>
            </div>

            {/* Desktop CTA - Call, Login, Get Started grouped together */}
            <div className="hidden lg:flex items-center gap-2">
              <a 
                href="tel:+61458300051" 
                title="Call us — 0458 300 051"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-brand hover:text-brand-accent hover:bg-brand/5 transition-colors"
                onClick={() => trackEvent('cta_click', { location: 'nav', button: 'call_support' })}
              >
                <Phone className="w-4 h-4" />
              </a>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <Link href="/auth?mode=login">
                  <Button variant="ghost" className="text-sm font-medium h-9 px-4 rounded-md hover:bg-white hover:shadow-sm transition-all" data-testid="nav-login">
                    Log In
                  </Button>
                </Link>
                <Link href="/auth?mode=signup">
                  <Button 
                    className="bg-brand-accent text-white text-sm font-semibold h-9 px-4 rounded-md shadow-sm transition-all" 
                    data-testid="nav-get-started"
                    onClick={() => trackEvent('cta_click', { location: 'nav', button: 'get_started_free' })}
                  >
                    Get Started Free
                  </Button>
                </Link>
              </div>
            </div>

            {/* Mobile: phone icon + menu button */}
            <div className="lg:hidden flex items-center gap-1">
              <a 
                href="tel:+61458300051" 
                title="Call us — 0458 300 051"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-brand hover:text-brand-accent hover:bg-brand/5 transition-colors"
                onClick={() => trackEvent('cta_click', { location: 'nav_mobile', button: 'call_support' })}
              >
                <Phone className="w-5 h-5" />
              </a>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
                data-testid="button-mobile-menu"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </LandingShell>
      </nav>

      {/* Mobile Menu - Slide from right with blur */}
      <div 
        className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop with blur */}
        <div 
          className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        
        {/* Slide-in panel */}
        <div 
          className={`absolute top-0 right-0 bottom-0 w-[280px] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <span className="flex items-center gap-2 text-base font-bold">
                <img src={jobrunnerLogo} alt="" loading="lazy" decoding="async" width="32" height="32" className="h-8 w-auto" />
                <span className="text-brand">Job</span>
                <span className="text-brand-accent">Runner</span>
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
                data-testid="button-close-menu"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 px-5 py-6">
              <nav className="space-y-1">
                <a 
                  href="#features" 
                  onClick={(e) => scrollToSection(e, "features")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-features"
                >
                  <Sparkles className="w-5 h-5 text-gray-400" />
                  Features
                </a>
                <a 
                  href="#how-it-works" 
                  onClick={(e) => scrollToSection(e, "how-it-works")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-how-it-works"
                >
                  <Play className="w-5 h-5 text-gray-400" />
                  How It Works
                </a>
                <a 
                  href="#pricing" 
                  onClick={(e) => scrollToSection(e, "pricing")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-pricing"
                >
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  Pricing
                </a>
                <a 
                  href="#download" 
                  onClick={(e) => scrollToSection(e, "download")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-download"
                >
                  <Download className="w-5 h-5 text-gray-400" />
                  Download App
                </a>
                <Link 
                  href="/portal" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-3 px-3 text-brand font-medium rounded-lg hover:bg-brand/5 transition-colors" 
                  data-testid="mobile-nav-client-portal"
                >
                  <Globe className="w-5 h-5 text-brand" />
                  Client Portal
                </Link>
              </nav>
            </div>

            {/* Bottom CTAs - Grouped together */}
            <div className="p-5 border-t border-gray-100 space-y-3">
              <Link href="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                <Button 
                  className="w-full bg-brand-accent text-white h-10 text-sm font-semibold rounded-lg" 
                  data-testid="mobile-get-started"
                  onClick={() => trackEvent('cta_click', { location: 'mobile_menu', button: 'get_started_free' })}
                >
                  Get Started Free
                </Button>
              </Link>
              <Link href="/auth?mode=login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full h-10 text-sm font-medium rounded-lg" data-testid="mobile-login">
                  Log In
                </Button>
              </Link>
              <a 
                href="tel:+61458300051" 
                className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-brand transition-colors pt-2"
                onClick={() => trackEvent('cta_click', { location: 'mobile_menu', button: 'call_support' })}
              >
                <Phone className="w-4 h-4" />
                <span>Call us — 0458 300 051</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-28 pb-16 lg:pt-28 lg:pb-20 px-5 lg:px-8 lg:min-h-screen lg:flex lg:items-center">
        <LandingShell padded={false} className="w-full">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left animate-fade-in">
              {/* Eyebrow */}
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand mb-4">
                Job management for Australian trades
              </p>

              {/* Main Headline */}
              <h1 className="text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem] font-extrabold leading-[1.08] tracking-tight mb-6">
                Built for how jobs{" "}
                <span className="text-brand">actually run.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-base lg:text-lg text-gray-600 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Jobs, quotes, invoices, and payments — all in one place. Track progress, get paid faster, and keep your whole team on the same page from quote to completion.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <Link href="/auth?mode=signup">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto bg-brand-accent text-white font-semibold h-11 px-6 text-[15px] rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] transition-all" 
                    data-testid="hero-start-trial"
                    onClick={() => trackEvent('cta_click', { location: 'hero', button: 'get_started_free' })}
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full sm:w-auto h-11 px-6 text-[15px] font-medium rounded-lg border-gray-300 hover:bg-gray-50 hover:scale-[1.02] transition-all" 
                  data-testid="hero-try-demo"
                  onClick={() => {
                    trackEvent('cta_click', { location: 'hero', button: 'try_demo' });
                    handleDemoLogin();
                  }}
                  disabled={isDemoLoading}
                >
                  {isDemoLoading ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      Loading Demo...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Try the Demo
                    </>
                  )}
                </Button>
              </div>

              {/* Free tier note */}
              <p className="text-[13px] text-gray-500">
                Free plan available — no credit card required.
              </p>
            </div>

            {/* Right: Hero Video */}
            <div className="relative flex justify-center lg:justify-end animate-fade-in-up lg:-mt-6">
              <div className="relative w-full max-w-[500px] sm:max-w-[560px] lg:max-w-[620px] animate-float">
                {/* Raw video — soft radial fade so the off-white background dissolves into the page */}
                <video
                  src="/videos/hero-demo-muted.mp4"
                  poster="/videos/hero-demo-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="w-full h-auto aspect-square object-cover"
                  style={{
                    WebkitMaskImage:
                      'radial-gradient(ellipse 70% 85% at center, black 55%, transparent 95%)',
                    maskImage:
                      'radial-gradient(ellipse 70% 85% at center, black 55%, transparent 95%)',
                  }}
                  data-testid="hero-video"
                />

                {/* Decorative gradient blob */}
                <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-brand/10 via-brand-accent/5 to-transparent rounded-full blur-3xl opacity-60"></div>
              </div>
            </div>
          </div>
        </LandingShell>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 border-y border-gray-100 bg-gray-50/50">
        <LandingShell>
          <AnimatedSection>
            <p className="text-center text-xs text-gray-500 mb-5">Built for trade businesses across Australia</p>
            <div className="flex flex-wrap justify-center items-center gap-5 lg:gap-10">
              {["Electricians", "Plumbers", "Builders", "HVAC Techs", "Property Maintenance"].map((trade, i) => (
                <span 
                  key={trade} 
                  className="text-gray-400 font-medium text-xs uppercase tracking-wider hover:text-gray-600 transition-colors cursor-default"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {trade}
                </span>
              ))}
            </div>
          </AnimatedSection>
        </LandingShell>
      </section>

      {/* Work From Anywhere - Mockup Showcase with Toggle */}
      <section className="py-16 lg:py-24 bg-gradient-to-b from-white to-gray-50/50">
        <LandingShell>
          <AnimatedSection className="text-center mb-10 lg:mb-14">
            <span className="inline-block text-xs font-semibold text-brand uppercase tracking-wider mb-3">Work From Anywhere</span>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight mb-4">
              Your business, in your pocket
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto mb-7">
              Whether you're on-site with your phone or at your desk with a browser – JobRunner works wherever you do.
            </p>
            
            {/* Toggle Buttons */}
            <div className="inline-flex items-center bg-gray-900 rounded-full p-1.5" data-testid="mockup-toggle-container">
              <button
                onClick={() => setMockupMode('mobile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  mockupMode === 'mobile' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid="button-toggle-mobile"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile App
              </button>
              <button
                onClick={() => setMockupMode('web')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  mockupMode === 'web' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid="button-toggle-web"
              >
                <Monitor className="w-4 h-4" />
                Web App
              </button>
            </div>
          </AnimatedSection>

          {/* Mockup Display */}
          <AnimatedSection animation="scale" delay={100} className="relative">
            {/* Mobile App View - Environmental iPhone Mockup */}
            <div 
              className={`transition-all duration-500 ease-out ${
                mockupMode === 'mobile' 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'
              }`}
            >
              <div className="relative max-w-2xl mx-auto">
                <img 
                  src={iphoneMockup} 
                  alt="Tradesperson holding an iPhone running the JobRunner app on a construction site" 
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
              </div>
              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Works offline
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  iOS & Android
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Instant sync
                </span>
              </div>
            </div>

            {/* Web App View - Environmental MacBook Mockup */}
            <div 
              className={`transition-all duration-500 ease-out ${
                mockupMode === 'web' 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'
              }`}
            >
              <div className="relative max-w-4xl mx-auto">
                <img 
                  src={macbookMockup} 
                  alt="JobRunner web dashboard open on a MacBook at a construction project" 
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
              </div>
              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Full dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Team management
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Advanced reports
                </span>
              </div>
            </div>
          </AnimatedSection>
        </LandingShell>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 lg:py-24 scroll-mt-16">
        <LandingShell>
          {/* Section Header */}
          <AnimatedSection className="text-center mb-12 lg:mb-16">
            <span className="inline-block text-xs font-semibold text-brand-accent uppercase tracking-wider mb-3">Features</span>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight mb-4">
              Everything you need to run your business
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              From the first call to the final invoice. One app, no paperwork.
            </p>
          </AnimatedSection>

          {/* Feature 1: Scheduling */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-20 lg:mb-28">
            <AnimatedSection animation="fade-right" className="order-2 lg:order-1">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-xl mb-5">
                <Calendar className="w-5 h-5 text-brand" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                Your schedule. Your way.
              </h3>
              <p className="text-gray-600 text-base leading-relaxed mb-5">
                See your whole week at a glance. Drag and drop jobs, check team availability, and send reminders to clients — no surprises.
              </p>
              <ul className="space-y-3">
                <FeatureItem text="Drag & drop job scheduling" />
                <FeatureItem text="Team calendar & availability" />
                <FeatureItem text="Automatic client reminders" />
              </ul>
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100} className="order-1 lg:order-2 flex justify-center">
              <PhoneMockup screenshot={scheduleScreenshot} alt="JobRunner weekly schedule with drag-and-drop jobs on a phone" />
            </AnimatedSection>
          </div>

          {/* Feature 2: Job Map */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-20 lg:mb-28">
            <AnimatedSection animation="fade-right" className="flex justify-center">
              <PhoneMockup screenshot={jobMapScreenshot} alt="Map view in JobRunner showing all active jobs and team locations" />
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100}>
              <div className="inline-flex items-center justify-center w-10 h-10 bg-orange-100 rounded-xl mb-5">
                <MapPin className="w-5 h-5 text-brand-accent" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                See all your jobs on a map
              </h3>
              <p className="text-gray-600 text-base leading-relaxed mb-5">
                Plan your day visually. Track your team's locations in real-time and optimise routes to save time and fuel.
              </p>
              <a 
                href="#how-it-works" 
                onClick={(e) => scrollToSection(e, "how-it-works")}
                className="inline-flex items-center text-brand font-semibold hover:text-brand/80 transition-colors group" 
                data-testid="link-explore-maps"
              >
                Learn more <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </AnimatedSection>
          </div>

          {/* Feature 3: Quotes & Invoices */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-20 lg:mb-28">
            <AnimatedSection animation="fade-right" className="order-2 lg:order-1">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 rounded-xl mb-5">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                Quote on-site. Get paid faster.
              </h3>
              <p className="text-gray-600 text-base leading-relaxed mb-5">
                Create professional quotes in seconds. Convert to invoice with one tap. Get paid instantly with built-in payment links.
              </p>
              <ul className="space-y-3">
                <FeatureItem text="Professional PDF templates" />
                <FeatureItem text="One-tap quote to invoice" />
                <FeatureItem text="Stripe payment integration" />
              </ul>
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100} className="order-1 lg:order-2 flex justify-center">
              <PhoneMockup screenshot={quotePreviewScreenshot} alt="Professional quote preview in the JobRunner mobile app ready to send to a client" />
            </AnimatedSection>
          </div>

          {/* Feature 4: Job Management */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <AnimatedSection animation="fade-right" className="flex justify-center">
              <PhoneMockup screenshot={jobsListScreenshot} alt="List of active and upcoming jobs in the JobRunner mobile app" />
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100}>
              <div className="inline-flex items-center justify-center w-10 h-10 bg-purple-100 rounded-xl mb-5">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                Never lose track of a job again
              </h3>
              <p className="text-gray-600 text-base leading-relaxed mb-5">
                Every job from quote to completion in one place. Add photos, notes, and track progress. Know exactly where every project stands.
              </p>
              <ul className="space-y-3">
                <FeatureItem text="Visual job status tracking" />
                <FeatureItem text="Photos & notes on every job" />
                <FeatureItem text="Client communication history" />
              </ul>
            </AnimatedSection>
          </div>
        </LandingShell>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-gray-50 scroll-mt-16">
        <LandingShell>
          <AnimatedSection className="text-center mb-12">
            <span className="inline-block text-xs font-semibold text-brand-accent uppercase tracking-wider mb-3">How It Works</span>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight mb-4">
              Get up and running in minutes
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              No complicated setup. No training needed. Just sign up and start managing your business.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatedSection delay={0}>
              <StepCard 
                number={1}
                icon={Smartphone}
                title="Create your account"
                description="Sign up in under 2 minutes. Available on iOS, Android, and web."
              />
            </AnimatedSection>
            <AnimatedSection delay={150}>
              <StepCard 
                number={2}
                icon={Calendar}
                title="Add your first job"
                description="Enter client details, schedule the job, and start tracking your work."
              />
            </AnimatedSection>
            <AnimatedSection delay={300}>
              <StepCard 
                number={3}
                icon={CreditCard}
                title="Send quotes & get paid"
                description="Create professional quotes, convert to invoices, and accept payments."
              />
            </AnimatedSection>
          </div>
        </LandingShell>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 lg:py-24 scroll-mt-16">
        <LandingShell>
          <AnimatedSection className="text-center mb-12">
            <span className="inline-block text-xs font-semibold text-brand-accent uppercase tracking-wider mb-3">Pricing</span>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Start free, upgrade when you're ready. All prices in AUD including GST.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {/* Free Plan */}
            <AnimatedSection delay={0}>
              <PricingCard
                name="Free"
                price="$0"
                period="forever"
                description="Perfect for trying out JobRunner"
                features={[
                  "Unlimited quotes",
                  "25 jobs per month",
                  "25 invoices per month",
                  "Up to 50 clients",
                  "100MB photo storage",
                  "5 document templates"
                ]}
                buttonText="Get Started Free"
                buttonVariant="outline"
                href="/auth?mode=signup"
              />
            </AnimatedSection>

            {/* Pro Plan - Most Popular */}
            <AnimatedSection delay={150}>
              <PricingCard
                name="Pro"
                price="$49.99"
                period="/month"
                description="Unlimited everything for solo operators"
                features={[
                  "Unlimited jobs",
                  "Unlimited quotes & invoices",
                  "Unlimited clients",
                  "Unlimited photo storage",
                  "All templates",
                  "Automatic reminders",
                  "AI Assistant",
                  "Custom branding",
                  "Recurring invoices",
                  "Priority support"
                ]}
                buttonText="Get Started Free"
                buttonVariant="default"
                popular={true}
                href="/auth?mode=signup&plan=pro"
              />
            </AnimatedSection>

            {/* Team Plan */}
            <AnimatedSection delay={300}>
              <PricingCard
                name="Team"
                price="$99.99"
                period="/month flat"
                description="Full power for growing businesses"
                features={[
                  "Everything in Pro",
                  "Up to 5 team members",
                  "Live team tracking",
                  "Team chat & messaging",
                  "Role-based access",
                  "Dispatch board",
                  "Geofence clock in/out",
                  "Job assignments",
                  "Advanced reporting"
                ]}
                buttonText="Get Started Free"
                buttonVariant="default"
                href="/auth?mode=signup&plan=team"
              />
            </AnimatedSection>

            {/* Business Plan */}
            <AnimatedSection delay={450}>
              <PricingCard
                name="Business"
                price="$199.99"
                period="/month flat"
                description="Advanced tools for established operators"
                features={[
                  "Everything in Team",
                  "Up to 15 team members",
                  "Premium integrations",
                  "Advanced automations",
                  "Dedicated account support",
                  "Priority onboarding",
                  "Custom workflows",
                  "Higher API limits"
                ]}
                buttonText="Get Started Free"
                buttonVariant="default"
                href="/auth?mode=signup&plan=business"
              />
            </AnimatedSection>
          </div>

          {/* Power Add-Ons */}
          <AnimatedSection delay={400} className="mt-14">
            <div className="text-center mb-8">
              <span className="inline-block text-xs font-semibold text-brand-accent uppercase tracking-wider mb-3">Power Add-Ons</span>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                Supercharge your business
              </h3>
              <p className="text-gray-600 max-w-xl mx-auto">
                Available on any paid plan. Add only what you need.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">AI Receptionist</h4>
                    <p className="text-sm text-gray-500">$30/month add-on</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {[
                    "Dedicated Australian phone number",
                    "AI answers calls 24/7 in your business name",
                    "Captures leads and caller details automatically",
                    "Live call transfer to your team when available",
                    "Customers see your number, not JobRunner's"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                        <Check className="w-2.5 h-2.5 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500">Includes dedicated number provisioning. Requires Pro or Team plan.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Custom Website</h4>
                    <p className="text-sm text-gray-500">Custom quote</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {[
                    "Professional website built for your trade business",
                    "Mobile-friendly design that converts visitors to leads",
                    "Integrated with your JobRunner quote requests",
                    "SEO optimised for your local area and trade",
                    "Ongoing hosting and support included"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                        <Check className="w-2.5 h-2.5 text-purple-600" />
                      </div>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500">Our team builds it for you. Available on any paid plan.</p>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={500} className="text-center mt-10">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-full px-4 py-2 mb-4">
              <span className="text-xs font-semibold text-green-700">
                Start free today. Upgrade when you're ready — cancel anytime.
              </span>
            </div>
            <p className="text-sm text-gray-500">No credit card required to get started.</p>
          </AnimatedSection>
        </LandingShell>
      </section>

      {/* Download Section - Web & Mobile Apps */}
      <section id="download" className="scroll-mt-16 py-16 lg:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <AnimatedSection className="text-center mb-10">
            <span className="inline-block text-xs font-semibold text-brand-accent uppercase tracking-wider mb-3">Get JobRunner</span>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight mb-4">
              Use it anywhere — web or mobile
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              JobRunner works on any device. Use the web app on your computer or download the mobile app to manage your business on the go.
            </p>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Web App Card */}
            <AnimatedSection animation="fade-right">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Web App</h3>
                    <p className="text-sm text-gray-500">Works in any browser</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Access JobRunner from your computer, laptop, or tablet. Perfect for office work, detailed quotes, and managing your business from your desk.
                </p>
                <Link href="/auth?mode=signup">
                  <Button className="w-full bg-brand text-white font-semibold h-10 text-sm rounded-lg" data-testid="download-web-app">
                    <Globe className="w-5 h-5 mr-2" />
                    Open Web App
                  </Button>
                </Link>
              </div>
            </AnimatedSection>

            {/* Mobile App Card */}
            <AnimatedSection animation="fade-left" delay={100}>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-brand-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Mobile App</h3>
                  <p className="text-sm text-gray-500">iOS available · Android coming soon</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Take photos, track time, and manage jobs on-site. The mobile app keeps everything synced with your web account automatically.
              </p>
              
              {/* App Store Badges */}
              <div className="flex flex-col gap-3">
                <a 
                  href="https://apps.apple.com/app/jobrunner/id6760283858"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 bg-black text-white rounded-lg px-5 py-3 hover:bg-gray-800 transition-colors"
                  data-testid="download-app-store"
                >
                  <SiApple className="w-6 h-6" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Download on the</div>
                    <div className="text-base font-semibold -mt-0.5">App Store</div>
                  </div>
                </a>
                
                <div
                  className="relative flex items-center justify-center gap-3 bg-gray-400 text-white rounded-lg px-5 py-3 cursor-not-allowed"
                  data-testid="download-google-play-coming-soon"
                  aria-disabled="true"
                >
                  <SiGoogleplay className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Coming soon to</div>
                    <div className="text-base font-semibold -mt-0.5">Google Play</div>
                  </div>
                </div>
              </div>
              </div>
            </AnimatedSection>
          </div>
          
          <AnimatedSection delay={200} className="text-center text-sm text-gray-500 mt-8">
            <p>Your data syncs seamlessly between web and mobile — work from anywhere!</p>
          </AnimatedSection>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 lg:py-24 bg-gradient-to-b from-brand to-brand-dark">
        <AnimatedSection className="max-w-3xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-bold text-white tracking-tight mb-5">
            Ready to simplify your business?
          </h2>
          <p className="text-base lg:text-lg text-blue-100 mb-8 max-w-xl mx-auto">
            Join thousands of Australian trade professionals running their business on JobRunner. Start free in under a minute.
          </p>
          <Link href="/auth?mode=signup">
            <Button 
              size="lg" 
              className="bg-brand-accent text-white font-semibold h-11 px-8 text-[15px] rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" 
              data-testid="cta-start-trial"
              onClick={() => trackEvent('cta_click', { location: 'footer_cta', button: 'get_started_free' })}
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-sm text-blue-200 mt-5">
            No credit card required. Cancel anytime.
          </p>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 lg:py-14">
        <LandingShell>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <button 
                onClick={scrollToTop}
                className="flex items-center gap-3 mb-5 hover:opacity-80 transition-opacity"
              >
                <img 
                  src={jobrunnerLogo} 
                  alt="" 
                  loading="lazy"
                  decoding="async"
                  width="32"
                  height="32"
                  className="h-8 w-auto brightness-0 invert"
                />
                <span className="text-base font-bold">
                  <span className="text-blue-400">Job</span>
                  <span className="text-orange-400">Runner</span>
                </span>
              </button>
              <p className="text-sm leading-relaxed">
                Built for how jobs actually run. Jobs, quotes, invoices, and payments — all in one place.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Product</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a 
                    href="#features" 
                    onClick={(e) => scrollToSection(e, "features")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-features"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a 
                    href="#how-it-works" 
                    onClick={(e) => scrollToSection(e, "how-it-works")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-how-it-works"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a 
                    href="#pricing" 
                    onClick={(e) => scrollToSection(e, "pricing")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-pricing"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a 
                    href="#download" 
                    onClick={(e) => scrollToSection(e, "download")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-mobile-app"
                  >
                    Download App
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#how-it-works" onClick={(e) => scrollToSection(e, "how-it-works")} className="hover:text-white transition-colors" data-testid="link-about">About</a></li>
                <li><a href="mailto:admin@avwebinnovation.com" className="hover:text-white transition-colors" data-testid="link-contact">Contact</a></li>
                <li><Link href="/support" className="hover:text-white transition-colors" data-testid="link-support">Support</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors" data-testid="link-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors" data-testid="link-terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} LinkUp2Care Pty Ltd trading as JobRunner. All rights reserved.</p>
            <p className="mt-2 text-gray-500">Made with love in Australia</p>
          </div>
        </LandingShell>
      </footer>

      {/* Global Styles for animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-left {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in-right {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          will-change: opacity, transform;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          opacity: 0;
          will-change: opacity, transform;
        }
        /* Scroll-triggered animation classes */
        .scroll-fade-up {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .scroll-fade-left {
          opacity: 0;
          transform: translateX(-40px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-fade-left.visible {
          opacity: 1;
          transform: translateX(0);
        }
        .scroll-fade-right {
          opacity: 0;
          transform: translateX(40px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-fade-right.visible {
          opacity: 1;
          transform: translateX(0);
        }
        .scroll-scale {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-scale.visible {
          opacity: 1;
          transform: scale(1);
        }
        /* Staggered animations */
        .stagger-1 { transition-delay: 0.1s; }
        .stagger-2 { transition-delay: 0.2s; }
        .stagger-3 { transition-delay: 0.3s; }
        .stagger-4 { transition-delay: 0.4s; }
        /* Float animation for hero */
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        /* Prevent layout shift during image load */
        img {
          content-visibility: auto;
        }
        /* Smooth transitions for interactive elements */
        .group:hover .group-hover\\:shadow-2xl {
          transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>

      {/* Mobile App Download CTA Popup */}
      {showAppPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" style={{ animationFillMode: 'both' }}>
          <div 
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all"
            style={{ animation: 'fade-in-up 0.4s ease-out forwards' }}
          >
            {/* Close button */}
            <button
              onClick={dismissAppPopup}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
              data-testid="button-close-app-popup"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Gradient header */}
            <div className="bg-gradient-to-r from-brand to-brand-accent p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur rounded-2xl mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Get the JobRunner App
              </h3>
              <p className="text-white/90 text-sm">
                Manage your business from anywhere
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-sm">Take job photos on-site</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-sm">Track time and GPS location</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-sm">Works offline, syncs automatically</span>
                </div>
              </div>

              {/* App Store Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <a 
                  href="https://apps.apple.com/app/jobrunner/id6760283858" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white rounded-lg py-3 px-4 transition-colors"
                  data-testid="popup-app-store"
                >
                  <SiApple className="w-6 h-6" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Download on the</div>
                    <div className="text-sm font-semibold -mt-0.5">App Store</div>
                  </div>
                </a>
                <div
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-400 text-white rounded-lg py-3 px-4 cursor-not-allowed"
                  data-testid="popup-google-play-coming-soon"
                  aria-disabled="true"
                >
                  <SiGoogleplay className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Coming soon to</div>
                    <div className="text-sm font-semibold -mt-0.5">Google Play</div>
                  </div>
                </div>
              </div>

              {/* Dismiss link */}
              <button
                onClick={dismissAppPopup}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                data-testid="button-dismiss-app-popup"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneMockup({ screenshot, alt }: { screenshot: string; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const show = () => { img.style.opacity = '1'; };
    if (img.complete && img.naturalWidth > 0) {
      show();
      return;
    }
    img.addEventListener('load', show);
    img.addEventListener('error', show);
    return () => {
      img.removeEventListener('load', show);
      img.removeEventListener('error', show);
    };
  }, [screenshot]);
  
  return (
    <div className="relative w-[220px] sm:w-[240px] group">
      <div 
        className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-xl group-hover:shadow-2xl transition-shadow duration-500 will-change-auto"
        style={{ transform: 'translateZ(0)' }}
      >
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20"></div>
        
        <div className="relative bg-white rounded-[2.25rem] overflow-hidden aspect-[9/19.5]">
          <img 
            ref={imgRef}
            src={screenshot} 
            alt={alt}
            className="w-full h-full object-cover object-top transition-opacity duration-300"
            style={{ opacity: 0 }}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
        <Check className="w-3 h-3 text-green-600" />
      </div>
      <span className="text-gray-700">{text}</span>
    </div>
  );
}

function StepCard({ 
  number,
  icon: Icon, 
  title, 
  description
}: { 
  number: number;
  icon: any; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-brand text-white rounded-lg flex items-center justify-center font-bold text-base">
          {number}
        </div>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant = "default",
  popular = false,
  href,
  isContactSales = false
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: "default" | "outline";
  popular?: boolean;
  href?: string;
  isContactSales?: boolean;
}) {
  const handleContactSales = () => {
    window.location.href = "mailto:admin@avwebinnovation.com?subject=JobRunner%20Team%20Plan%20Enquiry&body=Hi%20JobRunner%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20the%20JobRunner%20Team%20plan%20for%20my%20business.%0A%0ABusiness%20Name%3A%20%0ANumber%20of%20Team%20Members%3A%20%0APhone%3A%20%0A%0AThanks!";
  };

  return (
    <div className={`relative bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 hover:shadow-md ${
      popular ? "border-brand-accent ring-2 ring-brand-accent/20" : "border-gray-100 hover:border-gray-200"
    }`}>
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-brand-accent text-white text-[11px] font-semibold px-3.5 py-1 rounded-full shadow-md">
            Most Popular
          </span>
        </div>
      )}
      
      <div className="text-center mb-5">
        <h3 className="text-lg font-bold text-gray-900 mb-1.5">{name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-extrabold text-gray-900">{price}</span>
          <span className="text-gray-500 text-xs">{period}</span>
        </div>
        <p className="text-gray-600 text-xs mt-1.5">{description}</p>
      </div>

      <ul className="space-y-2.5 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {isContactSales ? (
        <Button 
          variant={buttonVariant as any}
          onClick={() => {
            trackEvent('cta_click', { location: 'pricing', button: 'contact_sales', plan: name });
            handleContactSales();
          }}
          className="w-full h-10 text-sm font-semibold rounded-lg"
          data-testid={`pricing-${name.toLowerCase()}-cta`}
        >
          {buttonText}
        </Button>
      ) : (
        <Link href={href || "/auth?mode=signup"}>
          <Button 
            variant={buttonVariant as any}
            className={`w-full h-10 text-sm font-semibold rounded-lg ${
              buttonVariant === "default" 
                ? "bg-brand-accent text-white" 
                : ""
            }`}
            data-testid={`pricing-${name.toLowerCase()}-cta`}
            onClick={() => trackEvent('cta_click', { location: 'pricing', button: buttonText.toLowerCase().replace(/\s+/g, '_'), plan: name })}
          >
            {buttonText}
          </Button>
        </Link>
      )}
    </div>
  );
}
