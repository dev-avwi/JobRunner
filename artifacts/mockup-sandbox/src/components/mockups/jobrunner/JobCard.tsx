import React, { useState } from 'react';
import {
  ChevronLeft, MoreHorizontal, Pencil, Clock, Camera,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Building2, Navigation, Check, ArrowRight, Lock,
  ClipboardList, FileText, MessageSquare, Settings2,
  MapPin, Search, Map as MapIcon, Moon, Bell, Zap,
  AlertTriangle, PenLine,
} from 'lucide-react';

type FieldType = 'check' | 'passfail' | 'number' | 'select' | 'text' | 'textarea' | 'photo' | 'signature';

type Field = {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  unit?: string;
  options?: string[];
  value?: string;
  placeholder?: string;
  checked?: boolean;
  pf?: 'pass' | 'fail' | 'na' | null;
  photoCount?: number;
  signed?: boolean;
  showIf?: { fieldId: string; equals: string };
};

type Section = { id: string; title: string; fields: Field[] };

const INITIAL_SECTIONS: Section[] = [
  {
    id: 'service',
    title: 'Service Inspection',
    fields: [
      { id: 's1', type: 'passfail', label: 'Visual check — guides & tracks', required: true, pf: 'pass' },
      { id: 's2', type: 'passfail', label: 'Motor operation (up / down)', required: true, pf: 'pass' },
      { id: 's3', type: 'number', label: 'Static pressure reading', unit: 'kPa', required: true, value: '412' },
      { id: 's4', type: 'select', label: 'Overall condition', options: ['Good', 'Fair', 'Poor'], required: true, value: 'Good' },
      { id: 's5', type: 'passfail', label: 'Fault found?', required: true, pf: 'fail' },
      { id: 's6', type: 'textarea', label: 'Describe fault', required: true, value: 'Bottom rail weather seal perished — needs replacement next visit.', showIf: { fieldId: 's5', equals: 'fail' } },
      { id: 's7', type: 'photo', label: 'Fault photo', required: true, photoCount: 0, showIf: { fieldId: 's5', equals: 'fail' } },
      { id: 's8', type: 'textarea', label: 'General notes', value: 'Tracks cleared of debris and re-lubricated.', placeholder: 'Tap to add notes...' },
    ],
  },
  {
    id: 'pft',
    title: 'PFT / Pressure Test',
    fields: [
      { id: 'p1', type: 'number', label: 'Static pressure', unit: 'kPa', required: true, value: '410' },
      { id: 'p2', type: 'passfail', label: 'Dynamic operational pressure', required: true, pf: 'pass' },
      { id: 'p3', type: 'passfail', label: 'Hydraulic leaks present?', required: true, pf: 'pass' },
    ],
  },
  {
    id: 'shutter1',
    title: 'Shutter 1',
    fields: [
      { id: 'sh1', type: 'check', label: 'Curtain alignment', required: true, checked: true },
      { id: 'sh2', type: 'check', label: 'Spring tension check', required: true, checked: true },
      { id: 'sh3', type: 'passfail', label: 'Bearings greased', required: true, pf: 'pass' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin & Sign-off',
    fields: [
      { id: 'a1', type: 'check', label: 'Site left clean & tidy', required: true, checked: true },
      { id: 'a2', type: 'signature', label: 'Client signature', required: true, signed: false },
    ],
  },
];

type TabKey = 'card' | 'docs' | 'chat' | 'more';

const TABS: { key: TabKey; label: string; icon: typeof ClipboardList }[] = [
  { key: 'card', label: 'Job Card', icon: ClipboardList },
  { key: 'docs', label: 'Docs', icon: FileText },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'more', label: 'More', icon: Settings2 },
];

export default function JobCard() {
  const [sections, setSections] = useState<Section[]>(INITIAL_SECTIONS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['service']));
  const [activeTab, setActiveTab] = useState<TabKey>('card');
  const [jobNumber, setJobNumber] = useState('52734');

  const toggleSection = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const patchField = (sid: string, fid: string, patch: Partial<Field>) =>
    setSections(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => f.id !== fid ? f : { ...f, ...patch }),
    }));

  const isVisible = (f: Field, section: Section): boolean => {
    if (!f.showIf) return true;
    const ref = section.fields.find(x => x.id === f.showIf!.fieldId);
    if (!ref) return true;
    const cur = ref.type === 'passfail' ? ref.pf
      : ref.type === 'check' ? (ref.checked ? 'true' : 'false')
      : ref.value;
    return cur === f.showIf!.equals;
  };

  const isDone = (f: Field): boolean => {
    switch (f.type) {
      case 'check': return !!f.checked;
      case 'passfail': return f.pf != null;
      case 'photo': return (f.photoCount || 0) > 0;
      case 'signature': return !!f.signed;
      default: return !!(f.value && f.value.trim());
    }
  };

  let reqTotal = 0, reqDone = 0;
  sections.forEach(s => s.fields.forEach(f => {
    if (f.required && isVisible(f, s)) { reqTotal++; if (isDone(f)) reqDone++; }
  }));
  const reqLeft = reqTotal - reqDone;
  const progressPercent = reqTotal ? Math.round((reqDone / reqTotal) * 100) : 100;
  const canSubmit = reqLeft === 0;

  const pfColor = (v: string) =>
    v === 'pass' ? 'var(--status-completed)' : v === 'fail' ? 'var(--status-cancelled)' : 'var(--muted-foreground)';

  const renderField = (section: Section, f: Field) => {
    const required = f.required;
    const done = isDone(f);

    const labelRow = (
      <div className="flex items-center gap-1.5 mb-2">
        <span className="ios-body font-medium">{f.label}</span>
        {required && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={done
                  ? { backgroundColor: 'hsl(var(--status-completed) / 0.12)', color: 'hsl(var(--status-completed))' }
                  : { backgroundColor: 'hsl(var(--status-in-progress) / 0.14)', color: 'hsl(var(--status-in-progress))' }}>
            {done ? 'Done' : 'Required'}
          </span>
        )}
      </div>
    );

    switch (f.type) {
      case 'check':
        return (
          <button onClick={() => patchField(section.id, f.id, { checked: !f.checked })}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover-elevate text-left">
            {f.checked
              ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'hsl(var(--trade))' }} />
              : <Circle className="w-5 h-5 shrink-0 text-muted-foreground/40" />}
            <span className={`ios-body ${f.checked ? 'text-muted-foreground line-through' : ''}`}>{f.label}</span>
            {required && !f.checked && <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--status-in-progress))' }} />}
          </button>
        );

      case 'passfail':
        return (
          <div className="p-2.5">
            {labelRow}
            <div className="flex gap-2">
              {(['pass', 'fail'] as const).map(v => {
                const on = f.pf === v;
                return (
                  <button key={v} onClick={() => patchField(section.id, f.id, { pf: v })}
                          className="flex-1 py-2 rounded-xl text-[13px] font-semibold press-scale border capitalize"
                          style={on
                            ? { backgroundColor: `hsl(${pfColor(v)} / 0.12)`, color: `hsl(${pfColor(v)})`, borderColor: `hsl(${pfColor(v)} / 0.3)` }
                            : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))' }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="p-2.5">
            {labelRow}
            <div className="flex items-center bg-muted/60 border border-border rounded-xl px-3 py-2.5">
              <input value={f.value || ''} onChange={e => patchField(section.id, f.id, { value: e.target.value })}
                     inputMode="decimal"
                     className="flex-1 bg-transparent outline-none text-[15px] font-semibold tabular-nums" />
              {f.unit && <span className="ios-caption font-medium ml-2">{f.unit}</span>}
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="p-2.5">
            {labelRow}
            <div className="flex items-center justify-between bg-muted/60 border border-border rounded-xl px-3 py-2.5">
              <span className="text-[15px] font-medium">{f.value}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        );

      case 'text':
      case 'textarea':
        return (
          <div className="p-2.5">
            {labelRow}
            <div className={`bg-muted/60 border border-border rounded-xl p-3 ${f.type === 'textarea' ? 'min-h-[68px]' : ''}`}>
              <p className={`text-[14px] leading-snug ${f.value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                {f.value || f.placeholder || 'Tap to enter...'}
              </p>
            </div>
          </div>
        );

      case 'photo':
        return (
          <div className="p-2.5">
            {labelRow}
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
              <button onClick={() => patchField(section.id, f.id, { photoCount: (f.photoCount || 0) + 1 })}
                      className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover-elevate">
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Add</span>
              </button>
              {Array.from({ length: f.photoCount || 0 }).map((_, i) => (
                <div key={i} className="w-20 h-20 shrink-0 rounded-xl bg-muted border border-border overflow-hidden relative">
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.15), hsl(var(--muted)))' }} />
                  <div className="absolute bottom-1 right-1 bg-black/50 rounded px-1.5 py-0.5">
                    <span className="text-[9px] text-white font-medium">10:42</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'signature':
        return (
          <div className="p-2.5">
            {labelRow}
            {f.signed ? (
              <div className="flex items-center justify-between bg-status-completed/10 border border-status-completed/20 rounded-xl px-3 py-4">
                <span className="text-[22px] leading-none" style={{ fontFamily: 'cursive', color: 'hsl(var(--status-completed))' }}>M. Turner</span>
                <Check className="w-5 h-5" style={{ color: 'hsl(var(--status-completed))' }} />
              </div>
            ) : (
              <button onClick={() => patchField(section.id, f.id, { signed: true })}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/40 rounded-xl py-5 text-muted-foreground hover-elevate">
                <PenLine className="w-4 h-4" />
                <span className="text-[13px] font-semibold">Tap to capture signature</span>
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

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

        {/* Global app bar */}
        <div className="flex items-center justify-between px-4 pt-11 pb-2.5 bg-background border-b border-border shrink-0 z-20">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade))' }}>
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="text-[16px] font-extrabold tracking-tight" style={{ color: 'hsl(var(--trade))' }}>JobRunner</span>
          </div>
          <div className="flex items-center gap-0.5">
            {[MapPin, Search, MapIcon, Moon].map((Icon, i) => (
              <button key={i} className="p-1.5 rounded-full hover-elevate">
                <Icon className="w-[18px] h-[18px] text-muted-foreground" />
              </button>
            ))}
            <button className="p-1.5 rounded-full hover-elevate relative">
              <Bell className="w-[18px] h-[18px] text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 bg-status-cancelled text-white text-[8px] font-bold rounded-full px-1 leading-[13px]">9+</span>
            </button>
            <div className="w-7 h-7 rounded-full flex items-center justify-center ml-1 shrink-0" style={{ backgroundColor: 'hsl(var(--trade))' }}>
              <span className="text-[11px] font-bold text-white">MT</span>
            </div>
          </div>
        </div>

        {/* Scroll */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-32">

          {/* Back row */}
          <div className="flex items-center justify-between px-4 pt-3">
            <button className="inline-flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full bg-card border border-border shadow-sm hover-elevate">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[14px] font-semibold">Back</span>
            </button>
            <div className="flex items-center gap-1.5">
              <button className="p-2 rounded-full bg-card border border-border shadow-sm hover-elevate">
                <Pencil className="w-4 h-4" style={{ color: 'hsl(var(--trade))' }} />
              </button>
              <button className="p-2 rounded-full bg-card border border-border shadow-sm hover-elevate">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Title block */}
          <div className="px-5 pt-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-status-in-progress/10 text-status-in-progress border border-status-in-progress/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-status-in-progress animate-pulse-slow" />
              In Progress
            </span>
            <h1 className="ios-title leading-tight">Service Inspection</h1>
            <p className="ios-body text-muted-foreground mt-1 leading-snug">
              Motor service, pressure test and shutter inspection at Coastline Facilities.
            </p>

            {/* Job number — editable / auto */}
            <div className="flex items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 bg-muted/70 border border-border rounded-lg pl-2.5 pr-1.5 py-1.5">
                <span className="ios-caption font-semibold">Job</span>
                <span className="text-[14px] font-bold tabular-nums">#</span>
                <input value={jobNumber} onChange={e => setJobNumber(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
                       className="w-[62px] bg-transparent outline-none text-[14px] font-bold tabular-nums" />
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="ios-caption">Auto-generated · editable</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-4 pt-4">
            <div className="flex gap-1 p-1 bg-muted/70 rounded-2xl border border-border">
              {TABS.map(t => {
                const on = activeTab === t.key;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                          className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl press-scale"
                          style={on ? { backgroundColor: 'hsl(var(--trade))' } : undefined}>
                    <t.icon className="w-[18px] h-[18px]" style={{ color: on ? 'white' : 'hsl(var(--muted-foreground))' }} />
                    <span className="text-[11px] font-semibold" style={{ color: on ? 'white' : 'hsl(var(--muted-foreground))' }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'card' ? (
            <>
              {/* Context strip */}
              <div className="px-5 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border tabular-nums">
                    <Clock className="w-3 h-3" />
                    02:14:37
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-status-completed/10 text-status-completed border border-status-completed/20">
                    <Navigation className="w-3 h-3" />
                    On site
                  </span>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/60 rounded-xl mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--trade) / 0.12)' }}>
                    <Building2 className="w-4 h-4" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="ios-card-title">Coastline Facilities</span>
                    <span className="ios-caption leading-snug">14 Warehouse Rd, Botany NSW 2019</span>
                  </div>
                </div>

                {/* Required-to-close progress */}
                <div className="feed-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold">Required to close</span>
                    <span className="text-[13px] font-bold" style={{ color: canSubmit ? 'hsl(var(--status-completed))' : 'hsl(var(--status-in-progress))' }}>
                      {reqDone}/{reqTotal}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 ease-out"
                         style={{ width: `${progressPercent}%`, backgroundColor: canSubmit ? 'hsl(var(--status-completed))' : 'hsl(var(--trade))' }} />
                  </div>
                  {canSubmit ? (
                    <p className="ios-caption mt-2 flex items-center gap-1.5" style={{ color: 'hsl(var(--status-completed))' }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> All required fields complete
                    </p>
                  ) : (
                    <p className="ios-caption mt-2 flex items-center gap-1.5" style={{ color: 'hsl(var(--status-in-progress))' }}>
                      <AlertTriangle className="w-3.5 h-3.5" /> {reqLeft} required field{reqLeft > 1 ? 's' : ''} left before this job can close
                    </p>
                  )}
                </div>
              </div>

              {/* Sections */}
              <div className="p-4 space-y-3">
                {sections.map(section => {
                  const isOpen = expanded.has(section.id);
                  const visFields = section.fields.filter(f => isVisible(f, section));
                  const doneCount = visFields.filter(isDone).length;
                  const reqLeftHere = visFields.filter(f => f.required && !isDone(f)).length;
                  const allDone = visFields.every(isDone);

                  return (
                    <div key={section.id} className="feed-card">
                      <button onClick={() => toggleSection(section.id)}
                              className="w-full flex items-center justify-between p-4 text-left hover-elevate">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold"
                               style={allDone
                                 ? { backgroundColor: 'hsl(var(--status-completed) / 0.12)', color: 'hsl(var(--status-completed))' }
                                 : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                            {allDone ? <Check className="w-4 h-4" /> : doneCount}
                          </div>
                          <div className="flex flex-col">
                            <span className="ios-card-title">{section.title}</span>
                            {!isOpen && (
                              <span className="ios-caption">
                                {doneCount}/{visFields.length} done{reqLeftHere > 0 ? ` · ${reqLeftHere} required left` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isOpen && reqLeftHere > 0 && (
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--status-in-progress))' }} />
                          )}
                          {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-2 pb-3">
                          <div className="h-px w-full bg-border mb-1 mx-2" style={{ width: 'calc(100% - 1rem)' }} />
                          <div className="divide-y divide-border/60">
                            {visFields.map(f => (
                              <div key={f.id}>{renderField(section, f)}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-8 py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                {activeTab === 'docs' && <FileText className="w-6 h-6" style={{ color: 'hsl(var(--trade))' }} />}
                {activeTab === 'chat' && <MessageSquare className="w-6 h-6" style={{ color: 'hsl(var(--trade))' }} />}
                {activeTab === 'more' && <Settings2 className="w-6 h-6" style={{ color: 'hsl(var(--trade))' }} />}
              </div>
              <span className="ios-card-title">
                {activeTab === 'docs' ? 'Documents & PDFs' : activeTab === 'chat' ? 'Job Chat' : 'More Options'}
              </span>
              <span className="ios-caption max-w-[220px]">
                {activeTab === 'docs' && 'Quotes, invoices, the Job Proof Pack and compliance certificates live here.'}
                {activeTab === 'chat' && 'Messages with the client and team about this job.'}
                {activeTab === 'more' && 'Scheduling, assigned workers, timers and job settings.'}
              </span>
            </div>
          )}
        </div>

        {/* Sticky action bar — only on the Job Card tab */}
        {activeTab === 'card' && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-7 bg-card/90 backdrop-blur-md border-t border-border">
            {!canSubmit && (
              <p className="ios-caption text-center mb-2 flex items-center justify-center gap-1.5" style={{ color: 'hsl(var(--status-in-progress))' }}>
                <Lock className="w-3.5 h-3.5" /> {reqLeft} required field{reqLeft > 1 ? 's' : ''} left to complete
              </p>
            )}
            <button disabled={!canSubmit}
                    className="w-full font-semibold text-[16px] py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"
                    style={canSubmit
                      ? { backgroundColor: 'hsl(var(--trade))', color: 'white', boxShadow: '0 10px 15px -3px hsl(var(--trade) / 0.3)' }
                      : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', cursor: 'not-allowed' }}>
              {canSubmit ? <>Submit for approval <ArrowRight className="w-5 h-5" /></> : <>Complete required fields <Lock className="w-4 h-4" /></>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
