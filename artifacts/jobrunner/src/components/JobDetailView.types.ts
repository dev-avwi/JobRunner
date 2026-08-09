export interface Photo {
  url: string;
  caption?: string;
}

export type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

export interface Job {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  scheduledAt?: string;
  assignedTo?: string;
  status: JobStatus;
  photos?: Photo[];
  notes?: string;
  estimatedHours?: number;
  estimatedCost?: number;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
  startedAt?: string;
  completedAt?: string;
  invoicedAt?: string;
  workerStatus?: string;
  workerStatusUpdatedAt?: string;
  workerEta?: string;
  workerEtaMinutes?: number;
  portalEnabled?: boolean;
  requiresInspection?: boolean;
  inspectionCompletedAt?: string;
  inspectionNotes?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  sortOrder: number;
}

export interface LinkedDocument {
  id: string;
  title?: string;
  status: string;
  total: string;
  number?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  description?: string;
  lineItems?: QuoteLineItem[];
  createdAt?: string;
  dueDate?: string;
  paidAt?: string;
}

export interface JobMaterial {
  id: string;
  name: string;
  description?: string;
  quantity: string;
  unit: string;
  unitCost: string;
  unitPrice?: string;
  totalCost: string;
  totalPrice?: string;
  supplier?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  status: string;
  notes?: string;
  markupPercent?: string;
  receiptPhotoUrl?: string;
  createdAt: string;
}

export interface JobEquipmentAssignment {
  id: string;
  jobId: string;
  equipmentId: string;
  userId: string;
  notes: string | null;
  assignedAt: string;
}

export interface JobWithLinks {
  linkedQuote?: LinkedDocument | null;
  linkedInvoice?: LinkedDocument | null;
}

export interface TeamMember {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  isActive: boolean;
}

export interface JobDetailViewProps {
  jobId: string;
  onBack: () => void;
  onEditJob?: (jobId: string) => void;
  onCompleteJob?: (jobId: string) => void;
  onCreateQuote?: (jobId: string) => void;
  onCreateInvoice?: (jobId: string) => void;
  onViewClient?: (clientId: string) => void;
}
