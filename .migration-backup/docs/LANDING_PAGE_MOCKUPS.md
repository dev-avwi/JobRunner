# JobRunner Landing Page Mockups

This document contains self-contained HTML/JSX code for 6 key screens from JobRunner that can be used as interactive mockups on your landing page.

## How to Use These Mockups

Each mockup below is designed to be:
- **Static/Self-contained** - Uses hardcoded data, no API calls needed
- **Styled with Tailwind CSS** - Ensure your landing page project has Tailwind CSS installed
- **Uses Lucide React icons** - Install with `npm install lucide-react`
- **Dark mode compatible** - Uses CSS variables that can adapt to light/dark themes

---

## 1. Dashboard Mockup

A tradie's daily dashboard with today's schedule, time tracking widget, and quick actions.

```tsx
import { useState } from 'react';
import { 
  Briefcase, Clock, Phone, MapPin, Play, Square, Timer, 
  CheckCircle2, Navigation, Wrench, Calendar
} from 'lucide-react';

// Mock Data
const mockTodaysJobs = [
  { 
    id: '1', 
    title: 'Kitchen Sink Repair', 
    status: 'scheduled', 
    address: '42 Smith Street, Brisbane',
    clientName: 'John Watson',
    clientPhone: '0412 345 678',
    scheduledAt: '2024-01-15T09:00:00'
  },
  { 
    id: '2', 
    title: 'Hot Water System Install', 
    status: 'scheduled', 
    address: '18 Queen Road, Brisbane',
    clientName: 'Sarah Connor',
    clientPhone: '0423 456 789',
    scheduledAt: '2024-01-15T14:00:00'
  },
];

export default function DashboardMockup() {
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const nextJob = mockTodaysJobs[0];

  return (
    <div className="p-4 space-y-4 bg-background min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{getGreeting()}, Mike</h1>
        <p className="text-muted-foreground">Here's what you have today</p>
      </div>

      {/* Time Tracking Widget */}
      <div className={`rounded-xl border-2 p-4 ${activeTimer ? 'border-orange-500' : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${activeTimer ? 'bg-orange-100' : 'bg-muted'}`}>
              <Timer className={`h-6 w-6 ${activeTimer ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              {activeTimer ? (
                <>
                  <p className="text-2xl font-bold font-mono text-orange-500">{elapsedTime}</p>
                  <p className="text-sm text-muted-foreground">Working on: Kitchen Sink Repair</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">0h 0m today</p>
                  <p className="text-sm text-muted-foreground">No active timer</p>
                </>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => setActiveTimer(activeTimer ? null : '1')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTimer 
                ? 'bg-red-500 text-white' 
                : 'bg-orange-500 text-white'
            }`}
          >
            {activeTimer ? (
              <><Square className="h-4 w-4" /> Stop</>
            ) : (
              <><Play className="h-4 w-4" /> Start</>
            )}
          </button>
        </div>
      </div>

      {/* Next Job Card */}
      {nextJob && (
        <div className="rounded-xl border-2 border-primary/20 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Next Job</h2>
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
              Scheduled
            </span>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-xl">{nextJob.title}</h3>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatTime(nextJob.scheduledAt)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{nextJob.address}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{nextJob.clientName}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button className="flex flex-col items-center p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
              <Phone className="h-5 w-5 text-green-600 mb-1" />
              <span className="text-xs font-medium">Call</span>
            </button>
            <button className="flex flex-col items-center p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
              <Navigation className="h-5 w-5 text-blue-600 mb-1" />
              <span className="text-xs font-medium">Navigate</span>
            </button>
            <button className="flex flex-col items-center p-3 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors">
              <Wrench className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Start Work</span>
            </button>
          </div>
        </div>
      )}

      {/* Today's Jobs List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Today's Schedule</h2>
        <div className="space-y-2">
          {mockTodaysJobs.map((job) => (
            <div key={job.id} className="p-4 rounded-xl border hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{job.title}</span>
                <span className="text-xs text-muted-foreground">{formatTime(job.scheduledAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{job.address}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 2. Job Detail View Mockup

A complete job detail screen with status pipeline, client info, photos section, voice notes, and signature capture.

```tsx
import { useState } from 'react';
import { 
  ArrowLeft, Briefcase, User, MapPin, Calendar, Clock, 
  CheckCircle, Camera, FileText, Receipt, Edit, Mic
} from 'lucide-react';

// Mock Data
const mockJob = {
  id: '1',
  title: 'Kitchen Sink Repair',
  description: 'Replace leaking tap and fix drainage issue under sink',
  status: 'in_progress',
  address: '42 Smith Street, Brisbane QLD 4000',
  scheduledAt: '2024-01-15T09:00:00',
  estimatedHours: 3,
  notes: 'Customer mentioned issue with water pressure as well. Check for blockages.'
};

const mockClient = {
  name: 'John Watson',
  email: 'john.watson@email.com',
  phone: '0412 345 678'
};

const mockPhotos = [
  { id: '1', url: '/api/placeholder/150/150', caption: 'Before - Sink' },
  { id: '2', url: '/api/placeholder/150/150', caption: 'Damaged pipe' },
];

const mockVoiceNotes = [
  { id: '1', duration: 45, createdAt: '2024-01-15T09:30:00', title: 'Site notes' }
];

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending', color: 'bg-gray-400' },
  { key: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
  { key: 'done', label: 'Completed', color: 'bg-green-500' },
  { key: 'invoiced', label: 'Invoiced', color: 'bg-purple-500' },
];

export default function JobDetailMockup() {
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  
  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === mockJob.status);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      done: 'bg-green-100 text-green-700',
      invoiced: 'bg-purple-100 text-purple-700',
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <div className="p-4 space-y-4 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">{mockJob.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hover:underline cursor-pointer">{mockClient.name}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(mockJob.status)}`}>
                In Progress
              </span>
            </div>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-muted">
          <Edit className="h-4 w-4" />
        </button>
      </div>

      {/* Status Pipeline */}
      <div className="rounded-xl border p-4">
        <h3 className="text-sm font-medium mb-3">Job Progress</h3>
        <div className="flex items-center justify-between relative">
          {/* Progress Line Background */}
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-muted -translate-y-1/2 z-0" />
          {/* Progress Line Filled */}
          <div 
            className="absolute left-0 top-1/2 h-1 bg-orange-500 -translate-y-1/2 z-0 transition-all"
            style={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
          />
          
          {STATUS_STEPS.map((step, index) => (
            <div key={step.key} className="flex flex-col items-center z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                index <= currentStepIndex ? step.color : 'bg-muted-foreground/30'
              }`}>
                {index <= currentStepIndex ? <CheckCircle className="h-4 w-4" /> : index + 1}
              </div>
              <span className="text-xs mt-1 text-center max-w-[60px]">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Job Details Card */}
      <div className="rounded-xl border p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Briefcase className="h-4 w-4 text-orange-500" />
          Job Details
        </div>
        
        {mockJob.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{mockJob.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <User className="h-3 w-3" /> Client
            </div>
            <p className="font-medium">{mockClient.name}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <MapPin className="h-3 w-3" /> Address
            </div>
            <p className="font-medium">{mockJob.address}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Calendar className="h-3 w-3" /> Scheduled
            </div>
            <p className="font-medium">{formatDate(mockJob.scheduledAt)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Clock className="h-3 w-3" /> Est. Hours
            </div>
            <p className="font-medium">{mockJob.estimatedHours} hours</p>
          </div>
        </div>
      </div>

      {/* Notes Card */}
      {mockJob.notes && (
        <div className="rounded-xl border p-4">
          <h3 className="text-sm font-medium mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{mockJob.notes}</p>
        </div>
      )}

      {/* Photos Section */}
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4 text-orange-500" />
            Job Photos
          </div>
          <span className="text-xs text-muted-foreground">{mockPhotos.length} photos</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {mockPhotos.map((photo) => (
            <div key={photo.id} className="aspect-square rounded-lg bg-muted overflow-hidden relative group">
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <Camera className="h-6 w-6 text-gray-400" />
              </div>
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
          <button className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Add</span>
          </button>
        </div>
      </div>

      {/* Voice Notes Section */}
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Mic className="h-4 w-4 text-orange-500" />
          Voice Notes
        </div>
        <div className="space-y-2">
          {mockVoiceNotes.map((note) => (
            <div key={note.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Mic className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{note.title}</p>
                <p className="text-xs text-muted-foreground">{note.duration}s</p>
              </div>
              <button className="p-2 rounded-full hover:bg-background">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
                </div>
              </button>
            </div>
          ))}
          <button className="w-full p-3 rounded-lg bg-orange-500 text-white font-medium flex items-center justify-center gap-2">
            <Mic className="h-4 w-4" />
            Record Voice Note
          </button>
        </div>
      </div>

      {/* Client Signature Section */}
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Edit className="h-4 w-4 text-orange-500" />
          Client Signature
        </div>
        <button 
          onClick={() => setShowSignatureModal(true)}
          className="w-full p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors"
        >
          <Edit className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Tap to capture client signature</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-2">
        <button className="w-full py-3 px-4 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Complete Job
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" />
            Quote
          </button>
          <button className="py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Quote/Invoice Editor Mockup

A live quote editor with line items, GST calculations, and real-time preview.

```tsx
import { useState } from 'react';
import { 
  Plus, Trash2, Edit2, Eye, FileText, User, Calendar, 
  Package, ChevronLeft, DollarSign, Check
} from 'lucide-react';

// Mock Data
const mockClients = [
  { id: '1', name: 'John Watson', email: 'john@email.com' },
  { id: '2', name: 'Sarah Connor', email: 'sarah@email.com' },
];

const mockLineItems = [
  { id: '1', description: 'Labour - Kitchen Sink Repair', quantity: '3', unitPrice: '85' },
  { id: '2', description: 'Replacement Tap Fitting', quantity: '1', unitPrice: '120' },
  { id: '3', description: 'PVC Drainage Pipe', quantity: '2', unitPrice: '25' },
];

export default function QuoteEditorMockup() {
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [lineItems, setLineItems] = useState(mockLineItems);
  const [selectedClient, setSelectedClient] = useState(mockClients[0]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotal = (quantity: string, unitPrice: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + calculateTotal(item.quantity, item.unitPrice), 
    0
  );
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const removeItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Mobile Tab Switcher */}
      <div className="border-b-2 bg-card sticky top-0 z-10 shadow-sm lg:hidden">
        <div className="grid grid-cols-2 gap-1 p-1.5 bg-muted/60 m-2 rounded-lg">
          <button 
            onClick={() => setMobileView('edit')}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold transition-all ${
              mobileView === 'edit' 
                ? 'bg-orange-500 text-white shadow-md' 
                : 'text-muted-foreground'
            }`}
          >
            <Edit2 className="h-4 w-4" /> Edit
          </button>
          <button 
            onClick={() => setMobileView('preview')}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold transition-all ${
              mobileView === 'preview' 
                ? 'bg-orange-500 text-white shadow-md' 
                : 'text-muted-foreground'
            }`}
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Form Panel */}
        <div className={`flex-1 overflow-auto p-4 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <div className="space-y-6 max-w-xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-xl hover:bg-muted">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-bold">New Quote</h1>
              </div>
              <span className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-orange-100 text-orange-600">
                {formatCurrency(total)}
              </span>
            </div>

            {/* Client Selection */}
            <div className="rounded-2xl border p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-orange-500" />
                Client
              </div>
              <select className="w-full h-12 rounded-xl border px-3 bg-background">
                {mockClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            {/* Quote Details */}
            <div className="rounded-2xl border p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-orange-500" />
                Quote Details
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <input 
                  type="text" 
                  defaultValue="Kitchen Sink Repair"
                  className="w-full h-12 rounded-xl border px-3 mt-1 bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea 
                  defaultValue="Repair leaking tap and fix drainage issue"
                  className="w-full rounded-xl border px-3 py-2 mt-1 min-h-[80px] bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valid Until</label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="date" 
                    defaultValue="2024-02-15"
                    className="w-full h-12 rounded-xl border pl-10 bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="rounded-2xl border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-orange-500" />
                  Line Items
                </div>
                <span className="px-2 py-1 text-xs rounded-full bg-muted">
                  {lineItems.length} items
                </span>
              </div>

              <div className="space-y-2">
                {lineItems.map((item) => {
                  const itemTotal = calculateTotal(item.quantity, item.unitPrice);
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(parseFloat(item.unitPrice))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(itemTotal)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-muted">
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="w-full py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center gap-2 hover:border-orange-500 transition-colors">
                <Plus className="h-4 w-4" />
                Add Line Item
              </button>
            </div>

            {/* Totals */}
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-orange-500" />
                Totals
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span>{formatCurrency(gst)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between font-bold">
                  <span>Total (incl. GST)</span>
                  <span className="text-orange-500">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button className="w-full py-4 rounded-xl bg-orange-500 text-white font-semibold flex items-center justify-center gap-2">
              <Check className="h-5 w-5" />
              Create Quote
            </button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className={`flex-1 overflow-auto border-l bg-muted/30 p-6 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="max-w-[600px] mx-auto bg-white rounded-lg shadow-lg p-8">
            <div className="border-b pb-6 mb-6">
              <h1 className="text-2xl font-bold mb-1">QUOTE</h1>
              <p className="text-muted-foreground">Quote #Q-2024-001</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">FROM</h3>
                <p className="font-bold">North QLD Plumbing</p>
                <p className="text-sm text-muted-foreground">ABN: 12 345 678 901</p>
                <p className="text-sm text-muted-foreground">Cairns, QLD</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">TO</h3>
                <p className="font-bold">{selectedClient.name}</p>
                <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
              </div>
            </div>

            <table className="w-full mb-6">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-sm font-semibold">Description</th>
                  <th className="text-right py-2 text-sm font-semibold">Qty</th>
                  <th className="text-right py-2 text-sm font-semibold">Price</th>
                  <th className="text-right py-2 text-sm font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2 text-sm">{item.description}</td>
                    <td className="py-2 text-sm text-right">{item.quantity}</td>
                    <td className="py-2 text-sm text-right">{formatCurrency(parseFloat(item.unitPrice))}</td>
                    <td className="py-2 text-sm text-right font-medium">
                      {formatCurrency(calculateTotal(item.quantity, item.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-right">
              <div className="flex justify-end gap-8">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="w-24">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-end gap-8">
                <span className="text-muted-foreground">GST (10%)</span>
                <span className="w-24">{formatCurrency(gst)}</span>
              </div>
              <div className="flex justify-end gap-8 pt-2 border-t font-bold text-lg">
                <span>Total</span>
                <span className="w-24 text-orange-500">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Calendar View Mockup

A week/month calendar showing scheduled jobs with KPI stats.

```tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, User, Clock, CheckCircle2, Briefcase } from 'lucide-react';

// Mock Data
const mockJobs = [
  { id: '1', title: 'Kitchen Sink Repair', status: 'scheduled', scheduledDate: '2024-01-15', clientName: 'John Watson', location: '42 Smith St' },
  { id: '2', title: 'Hot Water Install', status: 'in_progress', scheduledDate: '2024-01-15', clientName: 'Sarah Connor', location: '18 Queen Rd' },
  { id: '3', title: 'Bathroom Reno', status: 'pending', scheduledDate: '2024-01-16', clientName: 'Mike Johnson', location: '7 Park Ave' },
  { id: '4', title: 'Gas Fitting', status: 'completed', scheduledDate: '2024-01-14', clientName: 'Lisa Chen', location: '55 Main St' },
];

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarMockup() {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date('2024-01-15'));

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(currentWeekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const getJobsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return mockJobs.filter(job => job.scheduledDate === dateStr);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date('2024-01-15'); // Mock today
    return date.toDateString() === today.toDateString();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
      in_progress: 'bg-orange-100 text-orange-700 border-orange-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const stats = {
    jobsToday: 2,
    jobsThisWeek: 4,
    upcoming: 5,
    completed: 12
  };

  return (
    <div className="p-4 space-y-4 bg-background min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">View and manage your job schedule</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: 'Today', value: stats.jobsToday, icon: Clock },
          { title: 'This Week', value: stats.jobsThisWeek, icon: Briefcase },
          { title: 'Upcoming', value: stats.upcoming, icon: Calendar },
          { title: 'Completed', value: stats.completed, icon: CheckCircle2 },
        ].map((stat) => (
          <div key={stat.title} className="rounded-xl border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <stat.icon className="h-4 w-4" />
              <span className="text-sm">{stat.title}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="p-2 rounded-lg border hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="px-3 py-2 rounded-lg border hover:bg-muted text-sm font-medium">
            Today
          </button>
          <button className="p-2 rounded-lg border hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold ml-2">
            {formatDate(weekDates[0])} - {formatDate(weekDates[6])}, 2024
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
            }`}
          >
            Week
          </button>
          <button 
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-7">
        {weekDates.map((date, index) => {
          const dayJobs = getJobsForDate(date);
          
          return (
            <div 
              key={date.toISOString()}
              className={`rounded-xl border p-3 ${isToday(date) ? 'ring-2 ring-orange-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isToday(date) ? 'text-orange-500 font-bold' : ''}`}>
                  {WEEK_DAYS[index]} {date.getDate()}
                </span>
                {dayJobs.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                    {dayJobs.length}
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                {dayJobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No jobs</p>
                ) : (
                  dayJobs.map((job) => (
                    <div 
                      key={job.id}
                      className="p-2 rounded-lg border hover:shadow-sm cursor-pointer transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm line-clamp-2">{job.title}</h4>
                      </div>
                      <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${getStatusColor(job.status)}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{job.clientName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{job.location}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 5. Team Map Mockup

A Life360-style interactive map with job pins and team member markers.

```tsx
import { useState } from 'react';
import { 
  MapPin, Users, Phone, Navigation, Filter, RefreshCw,
  Battery, Car, Wrench, Clock, Wifi, WifiOff, AlertTriangle
} from 'lucide-react';

// Mock Data
const mockJobs = [
  { id: '1', title: 'Kitchen Sink Repair', status: 'scheduled', lat: -16.92, lng: 145.77, clientName: 'John Watson', address: '42 Smith St' },
  { id: '2', title: 'Hot Water Install', status: 'in_progress', lat: -16.93, lng: 145.78, clientName: 'Sarah Connor', address: '18 Queen Rd' },
  { id: '3', title: 'Gas Fitting', status: 'done', lat: -16.91, lng: 145.76, clientName: 'Mike Johnson', address: '7 Park Ave' },
];

const mockTeamMembers = [
  { 
    id: '1', 
    name: 'Tom Wilson', 
    initials: 'TW',
    status: 'driving',
    speed: 45,
    battery: 72,
    currentJob: 'En route to Kitchen Sink',
    lastSeen: '2 min ago',
    isOnline: true
  },
  { 
    id: '2', 
    name: 'Sarah Miller', 
    initials: 'SM',
    status: 'working',
    speed: 0,
    battery: 35,
    currentJob: 'Hot Water Install',
    lastSeen: 'Just now',
    isOnline: true
  },
  { 
    id: '3', 
    name: 'Jake Brown', 
    initials: 'JB',
    status: 'offline',
    speed: 0,
    battery: 15,
    currentJob: null,
    lastSeen: '45 min ago',
    isOnline: false
  },
];

const mockAlerts = [
  { id: '1', type: 'arrival', userName: 'Sarah Miller', jobTitle: 'Hot Water Install', time: '5 min ago' },
  { id: '2', type: 'late', userName: 'Tom Wilson', jobTitle: 'Kitchen Sink', time: '10 min ago' },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3B82F6',
  in_progress: '#F59E0B',
  done: '#10B981',
};

const ACTIVITY_COLORS: Record<string, string> = {
  driving: '#3B82F6',
  working: '#F59E0B',
  online: '#22C55E',
  offline: '#6B7280',
};

export default function TeamMapMockup() {
  const [showTeamPanel, setShowTeamPanel] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'driving': return Car;
      case 'working': return Wrench;
      case 'online': return Wifi;
      default: return WifiOff;
    }
  };

  return (
    <div className="relative h-screen bg-slate-900 overflow-hidden">
      {/* Map Background (Placeholder) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900">
        {/* Grid pattern to simulate map */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
        
        {/* Job Markers */}
        {showJobs && mockJobs.map((job, index) => (
          <div 
            key={job.id}
            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-full"
            style={{ 
              left: `${30 + index * 20}%`, 
              top: `${40 + index * 10}%`,
            }}
          >
            <div 
              className="w-10 h-10 rounded-full rounded-bl-none rotate-45 flex items-center justify-center shadow-lg"
              style={{ 
                background: `linear-gradient(135deg, ${STATUS_COLORS[job.status]} 0%, ${STATUS_COLORS[job.status]}dd 100%)`,
                border: '3px solid white',
                boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 20px ${STATUS_COLORS[job.status]}60`
              }}
            >
              <Wrench className="h-4 w-4 text-white -rotate-45" />
            </div>
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white text-black text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {job.title}
            </div>
          </div>
        ))}

        {/* Team Member Markers */}
        {mockTeamMembers.filter(m => m.isOnline).map((member, index) => (
          <div 
            key={member.id}
            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
              left: `${25 + index * 25}%`, 
              top: `${50 + index * 8}%`,
            }}
            onClick={() => setSelectedMember(member.id)}
          >
            {/* Pulse animation */}
            <div 
              className="absolute w-16 h-16 rounded-full -top-2 -left-2 animate-ping"
              style={{ 
                background: ACTIVITY_COLORS[member.status],
                opacity: 0.3,
                animationDuration: '2s'
              }}
            />
            {/* Avatar */}
            <div 
              className="relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ 
                background: `linear-gradient(135deg, ${ACTIVITY_COLORS[member.status]} 0%, ${ACTIVITY_COLORS[member.status]}dd 100%)`,
                border: `4px solid ${ACTIVITY_COLORS[member.status]}`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 25px ${ACTIVITY_COLORS[member.status]}40`
              }}
            >
              {member.initials}
            </div>
            {/* Speed badge for driving */}
            {member.status === 'driving' && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full border-2 border-white font-bold">
                {member.speed} km/h
              </div>
            )}
            {/* Low battery indicator */}
            {member.battery <= 30 && (
              <div className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                <Battery className="h-2 w-2 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <button className="p-3 rounded-xl bg-white/10 backdrop-blur-lg border border-white/20 text-white hover:bg-white/20">
            <Filter className="h-5 w-5" />
          </button>
          <button className="p-3 rounded-xl bg-white/10 backdrop-blur-lg border border-white/20 text-white hover:bg-white/20">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowJobs(!showJobs)}
            className={`px-4 py-2 rounded-xl backdrop-blur-lg border text-sm font-medium flex items-center gap-2 ${
              showJobs ? 'bg-orange-500 text-white border-orange-400' : 'bg-white/10 text-white border-white/20'
            }`}
          >
            <MapPin className="h-4 w-4" />
            Jobs
          </button>
          <button 
            onClick={() => setShowTeamPanel(!showTeamPanel)}
            className={`px-4 py-2 rounded-xl backdrop-blur-lg border text-sm font-medium flex items-center gap-2 ${
              showTeamPanel ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/10 text-white border-white/20'
            }`}
          >
            <Users className="h-4 w-4" />
            Team
          </button>
        </div>
      </div>

      {/* Team Panel */}
      {showTeamPanel && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Location
              </h3>
              <span className="text-xs text-white/60">Last updated: Just now</span>
            </div>
            
            <div className="space-y-2">
              {mockTeamMembers.map((member) => {
                const StatusIcon = getStatusIcon(member.status);
                return (
                  <div 
                    key={member.id}
                    className={`p-3 rounded-xl ${
                      selectedMember === member.id ? 'bg-white/20' : 'bg-white/5'
                    } hover:bg-white/15 cursor-pointer transition-colors`}
                    onClick={() => setSelectedMember(member.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: ACTIVITY_COLORS[member.status] }}
                      >
                        {member.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{member.name}</span>
                          <StatusIcon className="h-3 w-3" style={{ color: ACTIVITY_COLORS[member.status] }} />
                        </div>
                        <p className="text-white/60 text-sm truncate">
                          {member.currentJob || 'No active job'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-white/60 text-xs">
                          <Battery className="h-3 w-3" />
                          {member.battery}%
                        </div>
                        <p className="text-white/40 text-xs">{member.lastSeen}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alerts */}
          {mockAlerts.length > 0 && (
            <div className="mt-3 bg-amber-500/20 backdrop-blur-xl rounded-xl border border-amber-500/30 p-3">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Recent Alerts
              </div>
              <div className="space-y-1">
                {mockAlerts.map((alert) => (
                  <div key={alert.id} className="text-xs text-white/80">
                    <span className="font-medium">{alert.userName}</span>
                    {alert.type === 'arrival' ? ' arrived at ' : ' is running late for '}
                    <span className="font-medium">{alert.jobTitle}</span>
                    <span className="text-white/50 ml-2">{alert.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-3">
        <h4 className="text-white/60 text-xs mb-2">Job Status</h4>
        <div className="space-y-1">
          {[
            { label: 'Scheduled', color: STATUS_COLORS.scheduled },
            { label: 'In Progress', color: STATUS_COLORS.in_progress },
            { label: 'Completed', color: STATUS_COLORS.done },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
              <span className="text-white/80 text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Mobile App Style Mockup

A phone-frame mockup showing the mobile dashboard experience.

```tsx
import { useState } from 'react';
import { 
  Home, Briefcase, Map, Menu, Plus, Clock, DollarSign,
  FileText, AlertCircle, ChevronRight, User, MapPin
} from 'lucide-react';

// Mock Data
const mockStats = {
  jobsToday: 3,
  overdueInvoices: 2,
  pendingQuotes: 5,
  weeklyRevenue: 4250
};

const mockTodaysJobs = [
  { id: '1', title: 'Kitchen Sink Repair', time: '9:00 AM', client: 'John Watson', status: 'scheduled' },
  { id: '2', title: 'Hot Water Install', time: '2:00 PM', client: 'Sarah Connor', status: 'scheduled' },
  { id: '3', title: 'Emergency Call-out', time: '4:30 PM', client: 'Mike Johnson', status: 'pending' },
];

export default function MobileAppMockup() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-8">
      {/* Phone Frame */}
      <div className="relative">
        {/* Phone Border */}
        <div className="w-[375px] h-[812px] bg-black rounded-[50px] p-3 shadow-2xl">
          {/* Phone Screen */}
          <div className="w-full h-full bg-white rounded-[40px] overflow-hidden flex flex-col">
            {/* Status Bar */}
            <div className="h-12 bg-white flex items-center justify-between px-8 pt-2">
              <span className="text-sm font-semibold">9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 flex items-end gap-0.5">
                  <div className="w-1 h-1 bg-black rounded-sm" />
                  <div className="w-1 h-2 bg-black rounded-sm" />
                  <div className="w-1 h-3 bg-black rounded-sm" />
                  <div className="w-1 h-4 bg-black rounded-sm" />
                </div>
                <span className="text-sm ml-1">5G</span>
                <div className="w-6 h-3 border border-black rounded-sm ml-1 relative">
                  <div className="absolute inset-0.5 right-1 bg-green-500 rounded-sm" />
                  <div className="absolute -right-0.5 top-1 w-0.5 h-1 bg-black rounded-r" />
                </div>
              </div>
            </div>

            {/* App Content */}
            <div className="flex-1 overflow-auto bg-gray-50">
              {/* Header */}
              <div className="bg-white px-5 py-4 border-b">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 text-sm">Good morning,</span>
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">M</span>
                  </div>
                </div>
                <h1 className="text-2xl font-bold">Mike</h1>
              </div>

              {/* Stats Grid */}
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold">{mockStats.jobsToday}</p>
                  <p className="text-gray-500 text-sm">Jobs Today</p>
                </div>
                
                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold">{mockStats.overdueInvoices}</p>
                  <p className="text-gray-500 text-sm">Overdue</p>
                </div>
                
                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold">{mockStats.pendingQuotes}</p>
                  <p className="text-gray-500 text-sm">Pending Quotes</p>
                </div>
                
                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(mockStats.weeklyRevenue)}</p>
                  <p className="text-gray-500 text-sm">This Week</p>
                </div>
              </div>

              {/* Today's Schedule */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Today's Schedule</h2>
                  <button className="text-orange-500 text-sm font-medium">See all</button>
                </div>
                
                <div className="space-y-2">
                  {mockTodaysJobs.map((job) => (
                    <div key={job.id} className="bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{job.title}</h3>
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <span>{job.time}</span>
                          <span>•</span>
                          <span className="truncate">{job.client}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="px-4 pb-6">
                <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: Plus, label: 'New Job', color: 'bg-orange-500' },
                    { icon: User, label: 'Add Client', color: 'bg-blue-500' },
                    { icon: FileText, label: 'Quote', color: 'bg-green-500' },
                    { icon: MapPin, label: 'Navigate', color: 'bg-purple-500' },
                  ].map((action) => (
                    <button key={action.label} className="flex flex-col items-center gap-2 p-3">
                      <div className={`w-12 h-12 rounded-xl ${action.color} flex items-center justify-center`}>
                        <action.icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-xs text-gray-600">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Navigation */}
            <div className="h-20 bg-white border-t flex items-center justify-around px-6 pb-4">
              {[
                { icon: Home, label: 'Dashboard', id: 'dashboard' },
                { icon: Briefcase, label: 'Jobs', id: 'jobs' },
                { icon: Map, label: 'Map', id: 'map' },
                { icon: Menu, label: 'More', id: 'more' },
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 ${
                    activeTab === tab.id ? 'text-orange-500' : 'text-gray-400'
                  }`}
                >
                  <tab.icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notch */}
        <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-[20px] flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-800" />
          <div className="w-12 h-4 rounded-full bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
```

---

## Usage Tips

1. **Install Dependencies**:
   ```bash
   npm install lucide-react
   ```

2. **Tailwind CSS Required**: Ensure your project has Tailwind CSS configured.

3. **Customizing Colors**: The mockups use orange (`#F59E0B` or `orange-500`) as the primary brand color. You can easily change this by searching and replacing color classes.

4. **Adding Interactivity**: Each mockup includes basic state management with `useState` hooks. You can extend these to add more sophisticated interactions.

5. **Responsive Design**: These mockups are designed mobile-first. The Quote Editor and Calendar include tablet/desktop layouts.

6. **Dark Mode**: Add dark mode support by using Tailwind's `dark:` variant classes.

---

## License

These mockups are extracted from JobRunner and provided for demonstration/portfolio purposes.
