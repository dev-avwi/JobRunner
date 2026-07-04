import React, { useState } from 'react';
import {
  ChevronLeft, MoreVertical, Clock, Camera,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Building2, Navigation, Check, ArrowRight
} from 'lucide-react';

type ChecklistItem = { id: string; label: string; checked: boolean };
type Section = { id: string; title: string; items: ChecklistItem[]; note: string; photoCount: number };

const INITIAL_SECTIONS: Section[] = [
  {
    id: 'service',
    title: 'Service Inspect',
    items: [
      { id: 's1', label: 'Visual check of guides and tracks', checked: true },
      { id: 's2', label: 'Motor operation test (up/down)', checked: true },
      { id: 's3', label: 'Check limit switches', checked: true },
      { id: 's4', label: 'Inspect bottom rail weather seal', checked: false },
    ],
    note: 'Tracks had minor debris build-up. Cleared out and lubricated.',
    photoCount: 2,
  },
  {
    id: 'pft',
    title: 'PFT / Pressure Test',
    items: [
      { id: 'p1', label: 'Static pressure check', checked: true },
      { id: 'p2', label: 'Dynamic operational pressure', checked: false },
      { id: 'p3', label: 'Check for hydraulic leaks', checked: false },
    ],
    note: '',
    photoCount: 1,
  },
  {
    id: 'shutter1',
    title: 'Shutter 1',
    items: [
      { id: 'sh1_1', label: 'Curtain alignment', checked: false },
      { id: 'sh1_2', label: 'Spring tension check', checked: false },
      { id: 'sh1_3', label: 'Grease bearings', checked: false },
    ],
    note: '',
    photoCount: 0,
  },
  {
    id: 'shutter2',
    title: 'Shutter 2',
    items: [
      { id: 'sh2_1', label: 'Curtain alignment', checked: false },
      { id: 'sh2_2', label: 'Spring tension check', checked: false },
      { id: 'sh2_3', label: 'Grease bearings', checked: false },
    ],
    note: '',
    photoCount: 0,
  },
  {
    id: 'admin',
    title: 'Admin & Sign-off',
    items: [
      { id: 'a1', label: 'Site left clean and tidy', checked: false },
      { id: 'a2', label: 'Client signature obtained', checked: false },
    ],
    note: '',
    photoCount: 0,
  },
];

export default function JobCard() {
  const [sections, setSections] = useState<Section[]>(INITIAL_SECTIONS);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['service', 'pft']));

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedSections(next);
  };

  const toggleCheck = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(sec => sec.id !== sectionId ? sec : {
      ...sec,
      items: sec.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item),
    }));
  };

  const totalItems = sections.reduce((acc, sec) => acc + sec.items.length, 0);
  const completedItems = sections.reduce((acc, sec) => acc + sec.items.filter(i => i.checked).length, 0);
  const progressPercent = Math.round((completedItems / totalItems) * 100) || 0;
  const sectionsComplete = sections.filter(s => s.items.every(i => i.checked)).length;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-200 p-4 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        @keyframes pulse-slow { 0%,100%{opacity:1} 50%{opacity:.4} }
        .animate-pulse-slow { animation: pulse-slow 2s cubic-bezier(0.4,0,0.6,1) infinite; }
        .hide-scrollbar::-webkit-scrollbar { display:none; }
        .hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
      `}} />

      {/* Device frame */}
      <div className="w-[390px] h-[844px] bg-background text-foreground relative overflow-hidden flex flex-col rounded-[40px] border-[10px] border-slate-900 shadow-2xl shrink-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-3 pt-11 pb-3 bg-background border-b border-border shrink-0 z-10">
          <button className="p-2 -ml-1 rounded-full hover-elevate">
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex flex-col items-center">
            <span className="ios-label">Job Card</span>
            <span className="text-[17px] font-bold tracking-tight">#52734</span>
          </div>
          <button className="p-2 -mr-1 rounded-full hover-elevate">
            <MoreVertical className="w-6 h-6 text-foreground" />
          </button>
        </div>

        {/* Scroll */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-32">

          {/* Context header */}
          <div className="bg-card px-5 pt-4 pb-5 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-status-in-progress/10 text-status-in-progress border border-status-in-progress/20">
                <span className="w-1.5 h-1.5 rounded-full bg-status-in-progress animate-pulse-slow" />
                In Progress
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border tabular-nums">
                <Clock className="w-3 h-3" />
                02:14:37
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-status-completed/10 text-status-completed border border-status-completed/20 ml-auto">
                <Navigation className="w-3 h-3" />
                On site
              </span>
            </div>

            <h1 className="ios-section-title leading-tight mb-3">
              Service Inspection <span className="text-muted-foreground font-normal">·</span> A25 Shutter
            </h1>

            <div className="flex items-start gap-3 mb-5 p-3 bg-muted/60 rounded-xl">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                   style={{ backgroundColor: 'hsl(var(--trade) / 0.12)' }}>
                <Building2 className="w-4 h-4" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div className="flex flex-col">
                <span className="ios-card-title">Coastline Facilities</span>
                <span className="ios-caption leading-snug">14 Warehouse Rd, Botany NSW 2019</span>
              </div>
            </div>

            {/* Progress */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-muted-foreground">Completion</span>
                <span className="font-bold">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out"
                     style={{ width: `${progressPercent}%`, backgroundColor: 'hsl(var(--trade))' }} />
              </div>
              <p className="ios-caption mt-0.5">{sectionsComplete} of {sections.length} sections complete</p>
            </div>
          </div>

          {/* Sections */}
          <div className="p-4 space-y-3">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const isCompleted = section.items.every(i => i.checked);
              const completedCount = section.items.filter(i => i.checked).length;

              return (
                <div key={section.id} className="feed-card">
                  {/* Section header */}
                  <button onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center justify-between p-4 text-left hover-elevate">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold"
                           style={isCompleted
                             ? { backgroundColor: 'hsl(var(--status-completed) / 0.12)', color: 'hsl(var(--status-completed))' }
                             : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                        {isCompleted ? <Check className="w-4 h-4" /> : completedCount}
                      </div>
                      <div className="flex flex-col">
                        <span className="ios-card-title">{section.title}</span>
                        {!isExpanded && (
                          <span className="ios-caption">
                            {completedCount}/{section.items.length} tasks · {section.photoCount} photos
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </button>

                  {/* Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="h-px w-full bg-border mb-3" />

                      {/* Checklist */}
                      <div className="space-y-0.5 mb-4">
                        {section.items.map((item) => (
                          <button key={item.id} onClick={() => toggleCheck(section.id, item.id)}
                                  className="w-full flex items-start gap-3 p-2.5 rounded-xl hover-elevate text-left">
                            <div className="mt-0.5 shrink-0">
                              {item.checked
                                ? <CheckCircle2 className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                                : <Circle className="w-5 h-5 text-muted-foreground/40" />}
                            </div>
                            <span className={`ios-body ${item.checked ? 'text-muted-foreground line-through' : ''}`}>
                              {item.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Notes */}
                      <div className="mb-4">
                        <p className="ios-label mb-2 px-0.5">Notes</p>
                        <div className="bg-muted/60 border border-border rounded-xl p-3 min-h-[70px]">
                          <p className={`text-[14px] ${section.note ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                            {section.note || 'Tap to add notes...'}
                          </p>
                        </div>
                      </div>

                      {/* Photos */}
                      <div>
                        <p className="ios-label mb-2 px-0.5">Evidence Photos</p>
                        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 px-0.5">
                          <button className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover-elevate">
                            <Camera className="w-5 h-5" />
                            <span className="text-[10px] font-semibold">Add</span>
                          </button>
                          {Array.from({ length: section.photoCount }).map((_, i) => (
                            <div key={i} className="w-20 h-20 shrink-0 rounded-xl bg-muted border border-border overflow-hidden relative">
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.15), hsl(var(--muted)))' }} />
                              <div className="absolute bottom-1 right-1 bg-black/50 rounded px-1.5 py-0.5">
                                <span className="text-[9px] text-white font-medium">10:42</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-7 bg-card/85 backdrop-blur-md border-t border-border">
          <button className="w-full text-primary-foreground font-semibold text-[16px] py-3.5 rounded-2xl press-scale flex items-center justify-center gap-2 shadow-lg"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}>
            Submit for approval
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
