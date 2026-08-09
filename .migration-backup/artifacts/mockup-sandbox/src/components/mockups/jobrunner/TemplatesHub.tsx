import React, { useState } from 'react';
import {
  Search, Plus, ChevronRight, ShieldAlert,
  Settings2, DollarSign, Palette, Home, Calendar,
  Briefcase, ClipboardList, CheckCircle2, History,
  FileCheck2, LayoutTemplate, FileText
} from 'lucide-react';

export default function TemplatesHub() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-200 p-4 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Device frame */}
      <div className="w-[390px] h-[844px] bg-background text-foreground relative overflow-hidden rounded-[40px] border-[10px] border-slate-900 shadow-2xl flex flex-col">

        {/* Status bar */}
        <div className="h-12 w-full flex justify-between items-center px-7 pt-2 z-10 bg-background">
          <span className="text-[14px] font-semibold">9:41</span>
          <div className="flex space-x-1.5 items-center">
            <div className="w-4 h-2.5 bg-foreground rounded-[2px]" />
            <div className="w-2.5 h-2.5 bg-foreground rounded-full" />
            <div className="w-6 h-2.5 bg-foreground rounded-[3px]" />
          </div>
        </div>

        {/* Header */}
        <div className="bg-background px-5 pt-1 pb-4 z-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <LayoutTemplate className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div>
                <h1 className="text-[28px] font-bold tracking-tight leading-tight">Templates</h1>
                <p className="ios-caption mt-0.5">Job cards, forms &amp; pricing</p>
              </div>
            </div>
            <button className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground press-scale shadow-sm">
              <Plus size={18} />
            </button>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates & forms..."
              className="w-full bg-muted rounded-xl py-2.5 pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-28">
          <div className="px-5 pt-1 space-y-6">

            {/* QUICK KPI ROW */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: ClipboardList, tint: 'var(--trade)', count: '14', label: 'Job Cards' },
                { icon: ShieldAlert, tint: 'var(--status-in-progress)', count: '5', label: 'SWMS' },
                { icon: Palette, tint: 'var(--status-invoiced)', count: '4', label: 'Documents' },
                { icon: FileText, tint: 'var(--status-completed)', count: '3', label: 'Inputs' },
              ].map((k) => (
                <div key={k.label} className="feed-card card-press p-2.5 flex flex-col items-center text-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: `hsl(${k.tint} / 0.12)` }}>
                    <k.icon size={16} style={{ color: `hsl(${k.tint})` }} />
                  </div>
                  <span className="text-[19px] font-bold leading-none">{k.count}</span>
                  <span className="text-[10px] font-medium text-muted-foreground leading-tight">{k.label}</span>
                </div>
              ))}
            </div>

            {/* HERO: Job Card Templates */}
            <div className="rounded-2xl overflow-hidden relative shadow-lg"
                 style={{ background: 'linear-gradient(150deg, hsl(217 91% 53%) 0%, hsl(224 76% 40%) 100%)' }}>
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                      <ClipboardList size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-[19px] font-bold text-white leading-tight">Job Cards</h2>
                      <p className="text-white/70 text-[12px] font-medium uppercase tracking-wider mt-0.5">14 active templates</p>
                    </div>
                  </div>
                  <button className="text-white/70 hover:text-white p-1">
                    <Settings2 size={18} />
                  </button>
                </div>

                <p className="text-white/80 text-[14px] leading-relaxed mb-4">
                  Checklists your team fills out on site — the star of your templates.
                </p>

                <div className="space-y-2">
                  {[
                    { icon: CheckCircle2, name: 'Service Inspection', items: '12 items', used: '34x' },
                    { icon: FileCheck2, name: 'PFT / Pressure Test', items: '7 items', used: '89x' },
                    { icon: LayoutTemplate, name: 'Shutter Install', items: '9 items', used: '12x' },
                  ].map((t) => (
                    <div key={t.name} className="bg-white/12 backdrop-blur-md rounded-xl p-3 flex justify-between items-center border border-white/10 active:bg-white/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                          <t.icon size={16} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-[14px] leading-tight">{t.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-white/60 text-[11px] font-medium">{t.items}</span>
                            <span className="w-1 h-1 rounded-full bg-white/40" />
                            <span className="text-white/60 text-[11px] flex items-center"><History size={10} className="mr-1" /> used {t.used}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-white/50" />
                    </div>
                  ))}
                </div>

                <button className="mt-4 w-full text-white/90 text-[13px] font-semibold hover:text-white flex items-center justify-center transition-colors">
                  View all 14 job cards <ChevronRight size={14} className="ml-1" />
                </button>
              </div>
            </div>

            {/* Business Setup group */}
            <div className="space-y-3">
              <p className="ios-label ml-0.5">Business Setup</p>

              {[
                { icon: ShieldAlert, tint: 'var(--status-in-progress)', title: 'Safety & SWMS', sub: 'Risk assessments & site checklists', badge: '5 forms' },
                { icon: Settings2, tint: 'var(--trade)', title: 'Custom Forms', sub: 'Build-your-own data collection', badge: '3 forms' },
                { icon: DollarSign, tint: 'var(--status-completed)', title: 'Pricing & Rates', sub: 'Rate cards & materials catalog', badge: '2 catalogs' },
                { icon: Palette, tint: 'var(--status-invoiced)', title: 'Document Look', sub: 'Logo, colours & PDF appearance', badge: 'Set up' },
              ].map((row) => (
                <div key={row.title} className="feed-card card-press p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: `hsl(${row.tint} / 0.12)` }}>
                      <row.icon size={20} style={{ color: `hsl(${row.tint})` }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="ios-card-title truncate">{row.title}</h3>
                      <p className="ios-caption mt-0.5 truncate">{row.sub}</p>
                      <span className="inline-block mt-1.5 bg-muted text-muted-foreground text-[11px] font-medium px-2 py-0.5 rounded-full">{row.badge}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 w-full bg-card/95 backdrop-blur border-t border-border px-6 pt-2.5 pb-7 z-20">
          <div className="flex justify-between items-center">
            {[
              { icon: Home, label: 'Home', active: false },
              { icon: Calendar, label: 'Schedule', active: false },
              { icon: Briefcase, label: 'Jobs', active: false },
              { icon: LayoutTemplate, label: 'Templates', active: true },
              { icon: Settings2, label: 'More', active: false },
            ].map((n) => (
              <button key={n.label} className="flex flex-col items-center gap-1 transition-colors"
                      style={{ color: n.active ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))' }}>
                <n.icon size={22} />
                <span className="text-[10px] font-semibold">{n.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
