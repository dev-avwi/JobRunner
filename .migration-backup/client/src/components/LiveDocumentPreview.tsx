import { Building2 } from "lucide-react";
import { getTemplateStyles, TemplateId, TemplateCustomization, DEFAULT_TEMPLATE } from "@/lib/document-templates";

interface LineItem {
  itemCode?: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
}

interface BusinessInfo {
  businessName?: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  brandColor?: string;
  gstEnabled?: boolean;
  licenseNumber?: string;
  paymentInstructions?: string;
  bankDetails?: string;
  lateFeeRate?: string;
  warrantyPeriod?: string;
}

interface ClientInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface JobSignature {
  id: string;
  signerName: string;
  signatureData: string;
  signedAt: string | Date;
  documentType?: string;
}

interface LiveDocumentPreviewProps {
  type: "quote" | "invoice";
  documentNumber?: string;
  title: string;
  description?: string;
  date?: string;
  validUntil?: string;
  dueDate?: string;
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
  business: BusinessInfo;
  client: ClientInfo | null;
  showDepositSection?: boolean;
  depositPercent?: number;
  gstEnabled?: boolean;
  status?: string;
  jobAddress?: string;
  jobScheduledDate?: string;
  templateId?: TemplateId;
  templateCustomization?: TemplateCustomization;
  jobSignatures?: JobSignature[];
  acceptedAt?: string | Date | null;
  acceptedBy?: string | null;
  clientSignatureData?: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function LiveDocumentPreview({
  type,
  documentNumber,
  title,
  description,
  date,
  validUntil,
  dueDate,
  lineItems,
  notes,
  terms,
  business,
  client,
  showDepositSection = false,
  depositPercent = 50,
  gstEnabled = true,
  status,
  jobAddress,
  jobScheduledDate,
  templateId = DEFAULT_TEMPLATE,
  templateCustomization,
  jobSignatures = [],
  acceptedAt,
  acceptedBy,
  clientSignatureData,
}: LiveDocumentPreviewProps) {
  const safeParseFloat = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateLineTotal = (item: LineItem): number => {
    const qty = safeParseFloat(item.quantity);
    const price = safeParseFloat(item.unitPrice);
    return qty * price;
  };

  const validLineItems = lineItems.filter(item => {
    const qty = safeParseFloat(item.quantity);
    const price = safeParseFloat(item.unitPrice);
    return item.description && qty > 0 && price >= 0;
  });

  const subtotal = validLineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const gst = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;
  const depositAmount = showDepositSection ? total * ((depositPercent || 0) / 100) : 0;
  
  const brandColor = business.brandColor || '#2563eb';
  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';
  const isAccepted = status === 'accepted';
  
  // Get template styles - pass customization for accent color and other overrides
  console.log('[LiveDocumentPreview] Rendering with templateId:', templateId, 'customization:', templateCustomization?.tableStyle);
  const templateStyles = getTemplateStyles(templateId, brandColor, templateCustomization);
  console.log('[LiveDocumentPreview] Template styles - tableHeaderBg:', templateStyles.tableHeaderStyle.backgroundColor);
  const { template, primaryColor, headingStyle, tableHeaderStyle, tableHeaderRadius, getTableRowStyle, getNoteStyle } = templateStyles;

  // Keep title clean - the status badge shows "Paid" separately
  const documentTitle = type === 'quote' 
    ? 'Quote' 
    : gstEnabled 
      ? 'TAX INVOICE'
      : 'Invoice';

  const getStatusBadgeStyle = (s: string) => {
    switch (s) {
      case 'draft': return { background: '#e5e7eb', color: '#374151' };
      case 'sent': return { background: '#dbeafe', color: '#1d4ed8' };
      case 'accepted': return { background: '#dcfce7', color: '#166534' };
      case 'declined': return { background: '#fee2e2', color: '#991b1b' };
      case 'paid': return { background: '#dcfce7', color: '#166534' };
      case 'overdue': return { background: '#fee2e2', color: '#991b1b' };
      default: return { background: '#e5e7eb', color: '#374151' };
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-lg overflow-hidden w-full max-w-[800px] mx-auto border border-slate-200"
      style={{ 
        fontFamily: template.fontFamily,
        fontSize: template.baseFontSize,
        fontWeight: template.bodyWeight,
        lineHeight: '1.5',
        color: '#1a1a1a',
      }}
    >
      {/* Document Container */}
      <div className="p-6 sm:p-10">
        {/* Header - matches PDF .header */}
        <div 
          className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-10 pb-5"
          style={{ 
            borderBottom: template.showHeaderDivider 
              ? `${template.headerBorderWidth} solid ${primaryColor}` 
              : 'none' 
          }}
        >
          {/* Company Info - Left Side */}
          <div className="flex-1">
            {business.logoUrl && (
              <img 
                src={business.logoUrl} 
                alt={business.businessName || 'Business Logo'} 
                className="max-w-[150px] max-h-[60px] object-contain mb-3"
              />
            )}
            <div 
              className="text-2xl mb-2"
              style={{ 
                color: primaryColor,
                fontFamily: template.headingFont,
                fontWeight: template.headingWeight,
              }}
            >
              {business.businessName || 'Your Business Name'}
            </div>
            <div className="text-[10px] text-[#666] leading-[1.6] space-y-0.5">
              {business.abn && (
                <p><strong>ABN:</strong> {business.abn}</p>
              )}
              {business.address && (
                <p>{business.address}</p>
              )}
              {business.phone && (
                <p>Phone: {business.phone}</p>
              )}
              {business.email && (
                <p>Email: {business.email}</p>
              )}
              {business.licenseNumber && (
                <p>Licence No: {business.licenseNumber}</p>
              )}
            </div>
          </div>

          {/* Document Type - Right Side */}
          <div className="text-right">
            <div 
              className="uppercase mb-1"
              style={{ 
                color: isPaid ? '#22c55e' : primaryColor,
                fontSize: '28px',
                fontFamily: template.headingFont,
                fontWeight: template.headingWeight,
                letterSpacing: '1px',
                lineHeight: '1.2',
              }}
            >
              {documentTitle}
            </div>
            {documentNumber && (
              <div className="text-sm text-[#666] mt-1">
                {documentNumber}
              </div>
            )}
            {status && (
              <div className="mt-2">
                <span 
                  className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.5px]"
                  style={getStatusBadgeStyle(status)}
                >
                  {status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info Section - Bill To & Document Details */}
        <div className="flex flex-col sm:flex-row justify-between gap-10 mb-8">
          {/* Bill To / Quote For */}
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[1px] text-[#888] font-semibold mb-1.5">
              {type === 'quote' ? 'Quote For' : 'Bill To'}
            </div>
            <div className="leading-[1.5]">
              {client ? (
                <>
                  <p className="font-semibold">{client.name}</p>
                  {client.address && <p>{client.address}</p>}
                  {client.email && <p>{client.email}</p>}
                  {client.phone && <p>{client.phone}</p>}
                </>
              ) : (
                <p className="text-[#888] italic">Select a client...</p>
              )}
            </div>
          </div>

          {/* Document Details */}
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[1px] text-[#888] font-semibold mb-1.5">
              {type === 'quote' ? 'Quote Details' : 'Invoice Details'}
            </div>
            <div className="leading-[1.5]">
              <p><strong>Date:</strong> {formatDate(date || new Date().toISOString())}</p>
              {type === 'quote' && validUntil && (
                <p><strong>Valid Until:</strong> {formatDate(validUntil)}</p>
              )}
              {type === 'invoice' && dueDate && (
                <p><strong>Due Date:</strong> {formatDate(dueDate)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Job Site Location (if provided) */}
        {jobAddress && (
          <div className="flex flex-col sm:flex-row justify-between gap-10 mb-8 mt-4">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[1px] text-[#888] font-semibold mb-1.5">
                Job Site Location
              </div>
              <div className="leading-[1.5]">
                <p className="font-semibold">{jobAddress}</p>
                {jobScheduledDate && (
                  <p className="text-[#666]">
                    {type === 'quote' ? 'Scheduled:' : 'Completed:'} {formatDate(jobScheduledDate)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description Section */}
        {(title || description) && (
          <div className="mb-8 p-4 bg-[#f8f9fa] rounded-md">
            <div 
              className="font-semibold mb-2"
              style={{ color: primaryColor }}
            >
              {title || `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}
            </div>
            {description && (
              <div className="text-[#1a1a1a]">{description}</div>
            )}
          </div>
        )}

        {/* Line Items Table */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr style={{ 
              backgroundColor: tableHeaderStyle.backgroundColor,
              borderBottom: tableHeaderStyle.borderBottom,
            }}>
              <th className="px-3 py-3 text-left font-semibold text-[10px] uppercase tracking-[0.5px]" style={{ 
                width: '50%', 
                color: tableHeaderStyle.color,
                backgroundColor: tableHeaderStyle.backgroundColor,
                borderTopLeftRadius: tableHeaderRadius,
                borderBottomLeftRadius: tableHeaderRadius,
              }}>
                Description
              </th>
              <th className="px-3 py-3 text-right font-semibold text-[10px] uppercase tracking-[0.5px]" style={{ 
                width: '15%', 
                color: tableHeaderStyle.color,
                backgroundColor: tableHeaderStyle.backgroundColor,
              }}>
                Qty
              </th>
              <th className="px-3 py-3 text-right font-semibold text-[10px] uppercase tracking-[0.5px]" style={{ 
                width: '17%', 
                color: tableHeaderStyle.color,
                backgroundColor: tableHeaderStyle.backgroundColor,
              }}>
                Unit Price
              </th>
              <th className="px-3 py-3 text-right font-semibold text-[10px] uppercase tracking-[0.5px]" style={{ 
                width: '18%', 
                color: tableHeaderStyle.color,
                backgroundColor: tableHeaderStyle.backgroundColor,
                borderTopRightRadius: tableHeaderRadius,
                borderBottomRightRadius: tableHeaderRadius,
              }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {validLineItems.length > 0 ? (
              validLineItems.map((item, index) => (
                <tr 
                  key={index} 
                  style={getTableRowStyle(index, index === validLineItems.length - 1)}
                >
                  <td className="px-3 py-3 align-top">
                    {item.itemCode && (
                      <span className="block text-[10px] text-[#666] font-mono">{item.itemCode}</span>
                    )}
                    {item.description}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {safeParseFloat(item.quantity).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatCurrency(safeParseFloat(item.unitPrice))}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatCurrency(calculateLineTotal(item))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#888] italic">
                  Add line items to see them here...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals Section - Right Aligned */}
        <div className="flex justify-end mb-8">
          <div className="w-[280px]">
            <div className="flex justify-between py-2 border-b border-[#eee]">
              <span className="text-[#666]">Subtotal</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            {gstEnabled && (
              <div className="flex justify-between py-2 border-b border-[#eee]">
                <span className="text-[#666]">GST (10%)</span>
                <span className="font-semibold">{formatCurrency(gst)}</span>
              </div>
            )}
            <div 
              className="flex justify-between py-3 mt-1"
              style={{ borderTop: `2px solid ${isPaid ? '#22c55e' : primaryColor}` }}
            >
              <span 
                className="text-base"
                style={{ color: isPaid ? '#22c55e' : primaryColor, fontWeight: template.headingWeight }}
              >
                {isPaid ? 'Amount Paid' : `Total${gstEnabled ? ' (incl. GST)' : ''}`}
              </span>
              <span 
                className="text-base"
                style={{ color: isPaid ? '#22c55e' : primaryColor, fontWeight: template.headingWeight }}
              >
                {formatCurrency(total)}
              </span>
            </div>
            {gstEnabled && (
              <p className="text-right text-[9px] text-[#888] mt-1">
                GST included in total
              </p>
            )}
            
            {/* Deposit Section */}
            {showDepositSection && depositPercent > 0 && (
              <div className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#666]">Deposit Required ({depositPercent}%):</span>
                  <span className="font-semibold">{formatCurrency(depositAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#666]">Balance on completion:</span>
                  <span>{formatCurrency(total - depositAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Section (for invoices when not paid) */}
        {type === 'invoice' && !isPaid && (
          <div 
            className="mb-8 p-5 rounded-lg"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
              border: `1px solid ${primaryColor}30`
            }}
          >
            <div 
              className="font-semibold mb-3 text-xs"
              style={{ color: primaryColor }}
            >
              Payment Details
            </div>
            <div className="text-[10px] text-[#444] leading-[1.8] whitespace-pre-wrap">
              {business.paymentInstructions || 'Please contact us for payment options.'}
              {business.bankDetails && (
                <>
                  {'\n\n'}Bank Details:{'\n'}{business.bankDetails}
                </>
              )}
              {dueDate && (
                <>
                  {'\n\n'}Payment is due by {formatDate(dueDate)}.
                </>
              )}
              {business.lateFeeRate && (
                <>
                  {'\n'}Late payments may incur interest at {business.lateFeeRate}.
                </>
              )}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {notes && (
          <div 
            className="mb-8 p-4"
            style={getNoteStyle()}
          >
            <div className="font-semibold mb-2 text-[#333]">
              Additional Notes
            </div>
            <div className="text-[10px] text-[#666] whitespace-pre-wrap">
              {notes}
            </div>
          </div>
        )}

        {/* Terms Section */}
        {terms && (
          <div className="mb-8">
            <div className="font-semibold mb-2 text-[#333] text-[11px]">
              Terms & Conditions
            </div>
            <div className="text-[9px] text-[#666] leading-[1.6] whitespace-pre-wrap">
              {terms}
            </div>
          </div>
        )}

        {/* Warranty Section */}
        {business.warrantyPeriod && (
          <div 
            className="mb-8 p-4"
            style={getNoteStyle()}
          >
            <div className="font-semibold mb-2 text-[#333]">
              Warranty
            </div>
            <div className="text-[10px] text-[#666]">
              All work is guaranteed for {business.warrantyPeriod} from completion date.
            </div>
          </div>
        )}

        {/* Job Completion Signatures Section - Only show on invoices, not quotes */}
        {type === 'invoice' && jobSignatures.length > 0 && (
          <div className="mb-8 p-5 border border-slate-200 rounded-lg bg-slate-50">
            <div className="font-semibold mb-4 text-[#374151] text-[12px] uppercase tracking-wide">
              Job Completion Signatures
            </div>
            <div className="flex flex-wrap gap-6 justify-center">
              {jobSignatures.filter(sig => sig.signatureData).map((sig) => {
                // Ensure data URL prefix exists
                const sigDataUrl = sig.signatureData.startsWith('data:') 
                  ? sig.signatureData 
                  : `data:image/png;base64,${sig.signatureData}`;
                return (
                  <div key={sig.id} className="text-center min-w-[150px]">
                    <div className="bg-white border border-slate-200 rounded-md p-3 mb-2">
                      <img 
                        src={sigDataUrl} 
                        alt={`${sig.signerName || 'Client'} signature`}
                        className="max-h-[50px] max-w-[140px] w-auto mx-auto"
                      />
                    </div>
                    <div className="text-[11px] font-medium text-[#1f2937]">{sig.signerName || 'Client'}</div>
                    <div className="text-[10px] text-[#6b7280]">Client Signature</div>
                    <div className="text-[9px] text-[#9ca3af]">{formatDate(sig.signedAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quote Acceptance Section */}
        {type === 'quote' && status !== 'accepted' && status !== 'declined' && (
          <div className="mt-10 p-5 border-2 border-dashed border-[#ddd] rounded-lg">
            <div className="font-semibold mb-4 text-[#333]">
              Quote Acceptance
            </div>
            <p className="text-[10px] text-[#666] mb-5">
              By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
            </p>
            <div className="flex flex-col sm:flex-row gap-10 mt-5">
              <div className="flex-1">
                <p className="text-[10px] text-[#888] mb-8">Client Signature</p>
                <div className="border-b border-[#333]"></div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#888] mb-8">Print Name</p>
                <div className="border-b border-[#333]"></div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#888] mb-8">Date</p>
                <div className="border-b border-[#333]"></div>
              </div>
            </div>
          </div>
        )}

        {/* Accepted Quote Confirmation */}
        {type === 'quote' && status === 'accepted' && (
          <div 
            className="mb-8 p-5 rounded-lg"
            style={{ 
              background: '#dcfce7',
              borderLeft: '4px solid #22c55e'
            }}
          >
            <div className="font-semibold mb-3" style={{ color: '#166534' }}>
              Quote Accepted
            </div>
            {clientSignatureData && (
              <div className="mb-3 bg-white border border-slate-200 rounded-md p-3 inline-block">
                <img 
                  src={clientSignatureData.startsWith('data:') ? clientSignatureData : `data:image/png;base64,${clientSignatureData}`}
                  alt="Client signature"
                  className="max-h-[50px] max-w-[150px] w-auto"
                />
              </div>
            )}
            <div className="text-[11px]" style={{ color: '#166534' }}>
              {acceptedBy && <span className="font-medium">Signed by: {acceptedBy}</span>}
              {acceptedBy && acceptedAt && <span className="mx-2">•</span>}
              {acceptedAt && <span>Date: {formatDate(acceptedAt)}</span>}
            </div>
            {!acceptedBy && !acceptedAt && (
              <div className="text-[10px]" style={{ color: '#166534' }}>
                This quote has been accepted.
              </div>
            )}
          </div>
        )}

        {/* Payment Received Confirmation (for paid invoices) */}
        {type === 'invoice' && isPaid && (
          <div 
            className="mb-8 p-4 rounded-r-md"
            style={{ 
              background: '#dcfce7',
              borderLeft: '4px solid #22c55e'
            }}
          >
            <div className="font-semibold mb-2" style={{ color: '#166534' }}>
              Payment Received - Thank You!
            </div>
            <div className="text-[10px]" style={{ color: '#166534' }}>
              Amount: {formatCurrency(total)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-[#eee] text-center text-[9px] text-[#999]">
          <p>Thank you for your business!</p>
          {business.abn && (
            <p className="mt-1">ABN: {business.abn}</p>
          )}
          <p className="mt-1">Generated by JobRunner • {formatDate(new Date())}</p>
        </div>
      </div>
    </div>
  );
}
