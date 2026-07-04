import React, { useState } from 'react';
import { 
  ChevronLeft, MoreVertical, MapPin, Clock, Camera, 
  CheckCircle2, Circle, ImagePlus, ChevronDown, ChevronUp,
  Building2, Navigation, AlertCircle, Check
} from 'lucide-react';

// --- Data Models ---
type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type Section = {
  id: string;
  title: string;
  items: ChecklistItem[];
  note: string;
  photoCount: number;
};

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['service', 'pft'])
  );

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSections(next);
  };

  const toggleCheck = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        items: sec.items.map(item => 
          item.id === itemId ? { ...item, checked: !item.checked } : item
        )
      };
    }));
  };

  // Compute progress
  const totalItems = sections.reduce((acc, sec) => acc + sec.items.length, 0);
  const completedItems = sections.reduce((acc, sec) => acc + sec.items.filter(i => i.checked).length, 0);
  const progressPercent = Math.round((completedItems / totalItems) * 100) || 0;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        /* Custom scrollbar for photos */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Mobile Device Frame */}
      <div className="w-[390px] h-[844px] bg-slate-50 relative overflow-hidden flex flex-col rounded-[40px] border-[8px] border-slate-900 shadow-2xl shrink-0">
        
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-white border-b border-slate-200 shrink-0 z-10 relative">
          <button className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">JOB CARD</span>
            <span className="text-lg font-bold text-slate-900">#52734</span>
          </div>
          <button className="p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors">
            <MoreVertical className="w-6 h-6 text-slate-700" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-32">
          
          {/* Header Context Area */}
          <div className="bg-white px-5 pt-5 pb-6 border-b border-slate-200 shadow-sm relative z-0">
            {/* Status Pills Row */}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-slow"></span>
                In Progress
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium tracking-tight font-mono">
                <Clock className="w-3 h-3" />
                02:14:37
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium ml-auto">
                <Navigation className="w-3 h-3" />
                On site
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight mb-3">
              Service Inspection <span className="text-slate-400 font-normal">—</span> A25 Shutter
            </h1>

            <div className="flex items-start gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-slate-900">Coastline Facilities</span>
                <span className="text-sm text-slate-500 leading-snug">14 Warehouse Rd, Botany NSW 2019</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Completion</span>
                <span className="font-bold text-slate-900">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">3 of 5 sections complete</p>
            </div>
          </div>

          {/* Job Sections List */}
          <div className="p-4 space-y-4">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const isCompleted = section.items.every(i => i.checked);
              const completedCount = section.items.filter(i => i.checked).length;
              
              return (
                <div 
                  key={section.id} 
                  className={`bg-white rounded-2xl border transition-colors shadow-sm overflow-hidden
                    ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`
                  }
                >
                  {/* Section Header */}
                  <button 
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors
                        ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : <span className="text-xs font-semibold">{completedCount}</span>}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-semibold text-base ${isCompleted ? 'text-emerald-900' : 'text-slate-900'}`}>
                          {section.title}
                        </span>
                        {!isExpanded && (
                          <span className="text-xs text-slate-500">
                            {completedCount} / {section.items.length} tasks • {section.photoCount} photos
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Section Body (Expanded) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="h-px w-full bg-slate-100 mb-4" />
                      
                      {/* Checklist */}
                      <div className="space-y-1 mb-5">
                        {section.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => toggleCheck(section.id, item.id)}
                            className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="mt-0.5 shrink-0">
                              {item.checked ? (
                                <CheckCircle2 className="w-6 h-6 text-blue-600" />
                              ) : (
                                <Circle className="w-6 h-6 text-slate-300" />
                              )}
                            </div>
                            <span className={`text-base leading-snug ${item.checked ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                              {item.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Notes Field */}
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                          Notes
                        </label>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[80px]">
                          <p className={`text-sm ${section.note ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                            {section.note || 'Tap to add notes...'}
                          </p>
                        </div>
                      </div>

                      {/* Photos Row */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                          Evidence Photos
                        </label>
                        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-1">
                          <button className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:bg-slate-100 transition-colors">
                            <Camera className="w-5 h-5" />
                            <span className="text-[10px] font-semibold">Add</span>
                          </button>
                          
                          {/* Mock thumbnails based on photoCount */}
                          {Array.from({ length: section.photoCount }).map((_, i) => (
                            <div key={i} className="w-20 h-20 shrink-0 rounded-xl bg-slate-200 border border-slate-200 overflow-hidden relative group">
                              <div className="absolute inset-0 bg-gradient-to-tr from-slate-300 to-slate-200" />
                              <div className="absolute bottom-1 right-1 bg-black/40 rounded px-1.5 py-0.5">
                                <span className="text-[9px] text-white font-medium">10:42 AM</span>
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

        {/* Sticky Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 pb-8">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg py-4 rounded-2xl shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            Submit for approval
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
        </div>

      </div>
    </div>
  );
}
