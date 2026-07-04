import React, { useState } from 'react';
import { 
  Search, Plus, ChevronRight, ShieldAlert, 
  Settings2, DollarSign, Palette, Home, Calendar, 
  Briefcase, ClipboardList, CheckCircle2, History,
  FileCheck2, LayoutTemplate
} from 'lucide-react';

export default function TemplatesHub() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4 font-sans">
      <style dangerouslySetEffect={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      
      {/* Device Mockup Wrapper */}
      <div className="w-[390px] h-[844px] bg-slate-50 relative overflow-hidden rounded-[40px] border-[8px] border-slate-900 shadow-2xl flex flex-col">
        
        {/* Status Bar Area (Fake) */}
        <div className="h-12 w-full flex justify-between items-center px-6 pt-2 z-10 bg-white">
          <span className="text-[14px] font-semibold text-slate-900">9:41</span>
          <div className="flex space-x-2">
            <div className="w-4 h-3 bg-slate-900 rounded-sm"></div>
            <div className="w-3 h-3 bg-slate-900 rounded-full"></div>
            <div className="w-5 h-3 bg-slate-900 rounded-sm"></div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white px-5 pt-2 pb-4 shadow-sm z-10">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Templates</h1>
            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-md shadow-blue-200">
              <Plus size={20} />
            </button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Search templates & forms..." 
              className="w-full bg-slate-100 text-slate-900 rounded-xl py-2.5 pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-500 font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
          <div className="p-5 space-y-6">

            {/* 1. HERO: JOB CARD TEMPLATES */}
            <div className="relative rounded-2xl overflow-hidden shadow-lg shadow-blue-900/10">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-blue-900"></div>
              
              <div className="relative p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                      <ClipboardList size={22} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">Job Cards</h2>
                      <p className="text-blue-100 text-[13px] font-medium opacity-90">14 active templates</p>
                    </div>
                  </div>
                  <button className="text-white/70 hover:text-white p-1">
                    <Settings2 size={18} />
                  </button>
                </div>
                
                <p className="text-slate-300 text-[14px] leading-relaxed mb-5">
                  Checklists and forms your team fills out while on site.
                </p>

                {/* Inner Preview List */}
                <div className="space-y-2.5">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex justify-between items-center border border-white/10 active:bg-white/20 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-[14px]">Service Inspection</h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-400 text-[11px] font-medium">12 items</span>
                          <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                          <span className="text-slate-400 text-[11px] flex items-center"><History size={10} className="mr-1 inline" /> used 34x</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/40" />
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex justify-between items-center border border-white/10 active:bg-white/20 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <FileCheck2 size={16} className="text-emerald-300" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-[14px]">PFT / Pressure Test</h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-400 text-[11px] font-medium">7 items</span>
                          <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                          <span className="text-slate-400 text-[11px] flex items-center"><History size={10} className="mr-1 inline" /> used 89x</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/40" />
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex justify-between items-center border border-white/10 active:bg-white/20 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <LayoutTemplate size={16} className="text-amber-300" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-[14px]">Shutter Install</h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-400 text-[11px] font-medium">9 items</span>
                          <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                          <span className="text-slate-400 text-[11px] flex items-center"><History size={10} className="mr-1 inline" /> used 12x</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/40" />
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button className="text-blue-300 text-[13px] font-semibold hover:text-white flex items-center transition-colors">
                    View all 14 job cards <ChevronRight size={14} className="ml-1" />
                  </button>
                </div>
              </div>
            </div>

            {/* Standard Sections Group */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider ml-1">Business Setup</h3>
              
              {/* 2. SAFETY FORMS */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
                    <ShieldAlert size={24} className="text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-[15px]">Safety & SWMS</h3>
                    <p className="text-slate-500 text-[13px] mt-0.5">Risk assessments & site checklists</p>
                    <div className="mt-1 flex items-center">
                      <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-md">5 forms</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </div>

              {/* 3. CUSTOM FORMS */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Settings2 size={24} className="text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-[15px]">Custom Forms</h3>
                    <p className="text-slate-500 text-[13px] mt-0.5">Build-your-own data collection</p>
                    <div className="mt-1 flex items-center">
                      <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-md">3 forms</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </div>

              {/* 4. PRICING */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <DollarSign size={24} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-[15px]">Pricing & Rates</h3>
                    <p className="text-slate-500 text-[13px] mt-0.5">Rate cards and materials catalogs</p>
                    <div className="mt-1 flex items-center">
                      <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-md">2 catalogs</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </div>

              {/* 5. DOCUMENT LOOK */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                    <Palette size={24} className="text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-[15px]">Document Branding</h3>
                    <p className="text-slate-500 text-[13px] mt-0.5">Logo, colors & quote appearance</p>
                    <div className="mt-1 flex items-center">
                      <span className="bg-purple-100 text-purple-700 text-[11px] font-bold px-2 py-0.5 rounded-md">Setup complete</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full bg-white border-t border-slate-200 px-6 pt-3 pb-8 z-20">
          <div className="flex justify-between items-center">
            <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-900 transition-colors">
              <Home size={22} />
              <span className="text-[10px] font-semibold">Home</span>
            </button>
            <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-900 transition-colors">
              <Calendar size={22} />
              <span className="text-[10px] font-semibold">Schedule</span>
            </button>
            <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-900 transition-colors">
              <Briefcase size={22} />
              <span className="text-[10px] font-semibold">Jobs</span>
            </button>
            <button className="flex flex-col items-center space-y-1 text-blue-600 transition-colors">
              <LayoutTemplate size={22} />
              <span className="text-[10px] font-semibold">Templates</span>
            </button>
            <button className="flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-900 transition-colors">
              <Settings2 size={22} />
              <span className="text-[10px] font-semibold">More</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
