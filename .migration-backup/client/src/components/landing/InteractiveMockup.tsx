import { useState } from "react";
import { 
  Monitor, 
  Smartphone, 
  Sun, 
  Moon, 
  Briefcase, 
  Users, 
  FileText, 
  Receipt,
  Calendar,
  Clock,
  Settings,
  Home,
  MapPin,
  Menu,
  Plus,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Play,
  LogOut,
  Bell,
  DollarSign
} from "lucide-react";

interface InteractiveMockupProps {
  className?: string;
}

export function InteractiveMockup({ className = "" }: InteractiveMockupProps) {
  const [activeView, setActiveView] = useState<"web" | "mobile">("web");
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {/* Device Toggle */}
        <div className="inline-flex items-center p-1 rounded-full bg-slate-200 dark:bg-slate-800">
          <button
            onClick={() => setActiveView("web")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              activeView === "web"
                ? "bg-[hsl(24,100%,50%)] text-white shadow-lg"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            data-testid="toggle-web-view"
          >
            <Monitor className="w-4 h-4" />
            Web App
          </button>
          <button
            onClick={() => setActiveView("mobile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              activeView === "mobile"
                ? "bg-[hsl(24,100%,50%)] text-white shadow-lg"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            data-testid="toggle-mobile-view"
          >
            <Smartphone className="w-4 h-4" />
            Mobile App
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          data-testid="toggle-mockup-theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Mockup Display Area */}
      <div className="relative flex items-center justify-center min-h-[520px]">
        {/* Web Mockup */}
        <div
          className={`absolute transition-all duration-500 ease-in-out ${
            activeView === "web"
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          <WebMockup isDark={isDark} />
        </div>

        {/* Mobile Mockup */}
        <div
          className={`absolute transition-all duration-500 ease-in-out ${
            activeView === "mobile"
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          <MobileMockup isDark={isDark} />
        </div>
      </div>
    </div>
  );
}

// Trade orange color used throughout the app
const tradeColor = "hsl(24, 100%, 50%)";
const tradeColorBg = "hsl(24, 100%, 50%, 0.1)";

function WebMockup({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-slate-950" : "bg-white";
  const bgSidebar = isDark ? "bg-slate-900" : "bg-slate-50";
  const bgCard = isDark ? "bg-slate-900" : "bg-white";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const text = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";

  const menuItems = [
    { icon: Home, label: "Dashboard", active: true },
    { icon: Briefcase, label: "Jobs" },
    { icon: Users, label: "Clients" },
    { icon: FileText, label: "Quotes" },
    { icon: Receipt, label: "Invoices" },
    { icon: Calendar, label: "Calendar" },
    { icon: Clock, label: "Time" },
  ];

  return (
    <div className={`w-[820px] max-w-[90vw] rounded-xl overflow-hidden shadow-2xl border ${border}`}>
      {/* Browser Chrome */}
      <div className={`${isDark ? "bg-slate-900" : "bg-slate-100"} px-4 py-3 flex items-center gap-3 border-b ${border}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md ${isDark ? "bg-slate-800" : "bg-white"} border ${border}`}>
          <div className="w-4 h-4 rounded bg-green-500/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span className={`text-xs ${textMuted}`}>app.jobrunner.com.au</span>
        </div>
      </div>

      {/* App Content */}
      <div className={`${bg} flex`} style={{ height: "460px" }}>
        {/* Sidebar - matches AppSidebar.tsx */}
        <div className={`w-52 ${bgSidebar} border-r ${border} flex flex-col`}>
          {/* Header */}
          <div className="p-4 flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: tradeColor }}
            >
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className={`font-bold text-sm ${text}`}>Harris Electrical</p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="flex-1 px-2 py-2">
            <p className={`text-[10px] font-medium ${textMuted} px-2 mb-2`}>MAIN MENU</p>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    item.active
                      ? "text-white"
                      : `${textMuted} hover:bg-slate-100 dark:hover:bg-slate-800`
                  }`}
                  style={item.active ? { backgroundColor: tradeColor } : {}}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className={`p-3 border-t ${border}`}>
            <div 
              className={`flex items-center gap-2 p-2 rounded-lg border`}
              style={{ backgroundColor: tradeColorBg, borderColor: 'hsl(24, 100%, 50%, 0.2)' }}
            >
              <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-bold">LH</div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-medium truncate ${text}`}>Harris Electrical</p>
                <p className={`text-[9px] ${textMuted}`}>Pro Plan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - matches OwnerManagerDashboard.tsx */}
        <div className="flex-1 p-5 overflow-hidden">
          {/* Header */}
          <div className="mb-5">
            <h1 className={`text-xl font-bold ${text}`}>Good morning, Luke</h1>
            <p className={`text-sm ${textMuted}`}>You have 3 jobs scheduled today</p>
          </div>

          {/* Quick Links Grid - matches the KPI cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: "Jobs Today", value: "3", icon: Briefcase, color: tradeColor, bgColor: tradeColorBg },
              { label: "Overdue", value: "1", icon: AlertCircle, color: "hsl(0, 84%, 60%)", bgColor: "hsl(0, 84%, 60%, 0.1)" },
              { label: "Quotes Pending", value: "4", icon: Clock, color: "hsl(var(--muted-foreground))", bgColor: isDark ? "hsl(0,0%,30%,0.3)" : "hsl(0,0%,80%,0.5)" },
              { label: "This Month", value: "$12,450", icon: TrendingUp, color: "hsl(142, 76%, 36%)", bgColor: "hsl(142, 76%, 36%, 0.1)" },
            ].map((stat) => (
              <div key={stat.label} className={`${bgCard} border ${border} rounded-xl p-3`}>
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: stat.bgColor }}
                  >
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${text}`}>{stat.value}</p>
                    <p className={`text-[10px] ${textMuted}`}>{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className={`${bgCard} border ${border} rounded-xl p-3 mb-5`}>
            <div className="flex gap-2">
              <button 
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-white"
                style={{ backgroundColor: tradeColor }}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Job
              </button>
              <button className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border ${border} ${text}`}>
                <FileText className="w-3.5 h-3.5" />
                Quote
              </button>
              <button className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border ${border} ${text}`}>
                <DollarSign className="w-3.5 h-3.5" />
                Invoice
              </button>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: tradeColorBg }}
              >
                <Calendar className="w-3.5 h-3.5" style={{ color: tradeColor }} />
              </div>
              <h2 className={`text-sm font-semibold ${text}`}>Today</h2>
            </div>
            <button className={`text-[10px] ${textMuted} flex items-center`}>
              View All <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          {/* Job Cards */}
          <div className="space-y-2">
            {[
              { time: "8:00 AM", client: "Smith Residence", task: "Hot water system install", status: "in_progress" },
              { time: "11:30 AM", client: "Oceanview Apartments", task: "Switchboard upgrade", status: "scheduled" },
            ].map((job, i) => (
              <div 
                key={i} 
                className={`${bgCard} border ${border} rounded-xl p-3 ${i === 0 ? 'border-l-2' : ''}`}
                style={i === 0 ? { borderLeftColor: tradeColor } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: tradeColorBg }}
                    >
                      <span className="font-bold text-sm" style={{ color: tradeColor }}>{job.time.split(' ')[0]}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${textMuted}`}>{job.time.split(' ')[1]}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          job.status === "in_progress" 
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                            : `${isDark ? 'bg-slate-800' : 'bg-slate-100'} ${textMuted}`
                        }`}>
                          {job.status === "in_progress" ? "In Progress" : "Scheduled"}
                        </span>
                      </div>
                      <p className={`text-xs font-medium ${text}`}>{job.client}</p>
                      <p className={`text-[10px] ${textMuted}`}>{job.task}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${textMuted}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMockup({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-slate-950" : "bg-slate-50";
  const bgCard = isDark ? "bg-slate-900" : "bg-white";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const text = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="relative">
      {/* Phone Frame */}
      <div 
        className="w-[280px] rounded-[40px] p-3 shadow-2xl bg-slate-900"
        style={{ 
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)" 
        }}
      >
        {/* Screen */}
        <div className={`${bg} rounded-[32px] overflow-hidden relative`} style={{ height: "560px" }}>
          {/* Status Bar */}
          <div className={`px-6 pt-3 pb-2 flex items-center justify-between ${bg}`}>
            <span className={`text-xs font-medium ${text}`}>9:41</span>
            {/* Notch */}
            <div className="absolute left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {[2, 3, 4, 3].map((h, i) => (
                  <div key={i} className={`w-1 rounded-sm ${isDark ? "bg-white" : "bg-slate-900"} ${i === 3 ? 'opacity-50' : ''}`} style={{ height: `${h * 2}px` }} />
                ))}
              </div>
              <div className={`w-6 h-3 rounded-sm border ${isDark ? "border-white" : "border-slate-900"} flex items-center justify-end pr-0.5`}>
                <div className="w-4 h-2 rounded-sm bg-green-500" />
              </div>
            </div>
          </div>

          {/* App Header */}
          <div className={`px-4 py-3 ${bg}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: tradeColor }}
                >
                  LH
                </div>
                <div>
                  <p className={`text-sm font-semibold ${text}`}>Hey Luke!</p>
                  <p className={`text-xs ${textMuted}`}>3 jobs today</p>
                </div>
              </div>
              <button 
                className="p-2 rounded-full"
                style={{ backgroundColor: tradeColorBg }}
              >
                <Bell className="w-5 h-5" style={{ color: tradeColor }} />
              </button>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`${bgCard} border ${border} rounded-xl p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className={`text-[10px] ${textMuted}`}>Today</span>
                </div>
                <p className={`text-lg font-bold ${text}`}>$2,450</p>
              </div>
              <div className={`${bgCard} border ${border} rounded-xl p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4" style={{ color: tradeColor }} />
                  <span className={`text-[10px] ${textMuted}`}>Pending</span>
                </div>
                <p className={`text-lg font-bold ${text}`}>4 quotes</p>
              </div>
            </div>
          </div>

          {/* Today's Jobs */}
          <div className="px-4 py-2 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-semibold ${text}`}>Today's Jobs</h2>
              <button className="text-xs font-medium" style={{ color: tradeColor }}>See all</button>
            </div>

            {/* Job Cards */}
            <div className="space-y-3">
              {[
                { time: "8:00 AM", client: "Smith Residence", task: "Hot water install", status: "active", distance: "2.4 km" },
                { time: "11:30 AM", client: "Oceanview Apts", task: "Switchboard upgrade", status: "next", distance: "5.1 km" },
                { time: "2:00 PM", client: "Johnson Kitchen", task: "Power points", status: "later", distance: "3.8 km" },
              ].map((job, i) => (
                <div 
                  key={i} 
                  className={`${bgCard} border ${border} rounded-xl p-3 ${
                    job.status === "active" ? "border-2" : ""
                  }`}
                  style={job.status === "active" ? { borderColor: tradeColor } : {}}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${job.status === "active" ? "" : ""}`} style={{ color: job.status === "active" ? tradeColor : undefined }} />
                      <span className={`text-xs font-medium ${job.status === "active" ? "" : textMuted}`} style={{ color: job.status === "active" ? tradeColor : undefined }}>
                        {job.time}
                      </span>
                    </div>
                    {job.status === "active" && (
                      <span 
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: tradeColor }}
                      >
                        NOW
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${text} mb-1`}>{job.client}</p>
                  <p className={`text-xs ${textMuted} mb-2`}>{job.task}</p>
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-3 h-3 ${textMuted}`} />
                    <span className={`text-[10px] ${textMuted}`}>{job.distance} away</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Nav */}
          <div className={`absolute bottom-3 left-3 right-3 ${bgCard} border ${border} rounded-2xl p-2 flex items-center justify-around`}>
            {[
              { icon: Home, label: "Home", active: true },
              { icon: Briefcase, label: "Jobs" },
              { icon: Plus, label: "", accent: true },
              { icon: MapPin, label: "Map" },
              { icon: Menu, label: "More" },
            ].map((item) => (
              <button
                key={item.label || "add"}
                className={`flex flex-col items-center gap-1 px-3 py-1 ${
                  item.accent ? "rounded-xl -mt-4 shadow-lg" : ""
                }`}
                style={item.accent ? { backgroundColor: tradeColor } : {}}
              >
                <item.icon className={`w-5 h-5 ${
                  item.accent 
                    ? "text-white" 
                    : item.active 
                    ? "" 
                    : textMuted
                }`} 
                style={item.active && !item.accent ? { color: tradeColor } : {}}
                />
                {!item.accent && (
                  <span className={`text-[10px] ${item.active ? "font-medium" : textMuted}`} style={item.active ? { color: tradeColor } : {}}>
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Decorative glow */}
      <div 
        className="absolute -inset-4 rounded-full blur-3xl -z-10 opacity-30"
        style={{ background: `linear-gradient(to bottom, ${tradeColor}, transparent)` }}
      />
    </div>
  );
}

export default InteractiveMockup;
