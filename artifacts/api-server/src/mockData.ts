import { storage } from './storage';
import { calculateDocumentTotals } from './shared-financials';

const AUSTRALIAN_FIRST_NAMES = [
  'Sarah', 'David', 'Emma', 'James', 'Olivia', 'Michael', 'Sophia', 'Daniel',
  'Chloe', 'Matthew', 'Mia', 'Joshua', 'Emily', 'Andrew', 'Charlotte', 'Ryan',
  'Isabella', 'Benjamin', 'Grace', 'Nathan', 'Ava', 'Luke', 'Lily', 'Jack',
  'Zoe', 'Liam', 'Hannah', 'Noah', 'Ella', 'Ethan', 'Sophie', 'Mason'
];

const AUSTRALIAN_LAST_NAMES = [
  'Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor', 'Anderson', 'Thomas',
  'Johnson', 'White', 'Martin', 'Thompson', 'Nguyen', 'Walker', 'Harris', 'Lee',
  'Ryan', 'Robinson', 'Kelly', 'King', 'Davis', 'Wright', 'Evans', 'Roberts',
  'Green', 'Hall', 'Wood', 'Jackson', 'Clarke', 'Scott', 'Mitchell', 'Cooper'
];

const AUSTRALIAN_STREETS = [
  'Oak Street', 'Pine Avenue', 'Beach Road', 'Hill Drive', 'Park Lane',
  'River View', 'Mountain Close', 'Garden Terrace', 'Sunset Boulevard', 'Ocean Drive',
  'Maple Court', 'Cedar Way', 'Palm Circuit', 'Eucalyptus Crescent', 'Wattle Place',
  'Banksia Road', 'Gum Tree Lane', 'Fern Gully Drive', 'Koala Close', 'Kangaroo Court'
];

const QLD_SUBURBS = [
  { name: 'Cairns', postcode: '4870', lat: -16.9186, lng: 145.7781 },
  { name: 'Trinity Beach', postcode: '4879', lat: -16.7872, lng: 145.6969 },
  { name: 'Port Douglas', postcode: '4877', lat: -16.4834, lng: 145.4595 },
  { name: 'Palm Cove', postcode: '4879', lat: -16.7479, lng: 145.6719 },
  { name: 'Smithfield', postcode: '4878', lat: -16.8333, lng: 145.6833 },
  { name: 'Gordonvale', postcode: '4865', lat: -17.0933, lng: 145.7828 },
  { name: 'Earlville', postcode: '4870', lat: -16.9414, lng: 145.7328 },
  { name: 'Whitfield', postcode: '4870', lat: -16.8833, lng: 145.7333 },
  { name: 'Edge Hill', postcode: '4870', lat: -16.9000, lng: 145.7500 },
  { name: 'Redlynch', postcode: '4870', lat: -16.8833, lng: 145.6833 }
];

const PLUMBING_JOB_TITLES = [
  'Kitchen Tap Replacement',
  'Bathroom Leak Repair',
  'Hot Water System Service',
  'Blocked Drain Clearing',
  'Toilet Installation',
  'Shower Head Replacement',
  'Gas Fitting - BBQ',
  'Water Heater Installation',
  'Pipe Burst Emergency',
  'Bathroom Renovation Rough-In',
  'Laundry Taps Installation',
  'Dishwasher Connection',
  'Sewer Line Inspection',
  'Rainwater Tank Connection',
  'Solar Hot Water Service'
];

const ELECTRICAL_JOB_TITLES = [
  'Ceiling Fan Installation',
  'Powerpoint Addition',
  'LED Downlight Upgrade',
  'Switchboard Upgrade',
  'Safety Switch Installation',
  'Air Conditioning Power Supply',
  'Outdoor Lighting Installation',
  'Smoke Alarm Replacement',
  'EV Charger Installation',
  'Pool Pump Wiring',
  'Security Camera Power',
  'Home Theatre Wiring',
  'Solar Panel Connection',
  'Generator Connection',
  'Hot Tub Electrical'
];

const CARPENTRY_JOB_TITLES = [
  'Deck Construction',
  'Pergola Building',
  'Kitchen Cabinet Installation',
  'Door Replacement',
  'Window Frame Repair',
  'Fence Installation',
  'Stair Repairs',
  'Built-in Wardrobe',
  'Timber Floor Repair',
  'Outdoor Furniture Build',
  'Shed Construction',
  'Gate Installation',
  'Skirting Board Replacement',
  'Crown Molding Installation',
  'Custom Shelving'
];

const JOB_DESCRIPTIONS: Record<string, string[]> = {
  plumbing: [
    'Replace existing tap with new mixer tap including all fittings',
    'Locate and repair leak, replace damaged pipes if necessary',
    'Annual service including anode check and thermostat testing',
    'Clear blockage using high-pressure jetter, camera inspection if required',
    'Remove old toilet, install new including seating and connection',
    'Replace old shower head with water-efficient model',
    'Connect new BBQ to existing gas line, pressure test',
    'Install new electric/gas hot water system including connections',
    'Emergency repair of burst pipe, water damage assessment'
  ],
  electrical: [
    'Install ceiling fan with light kit, remove existing fitting',
    'Add new powerpoint to specified location',
    'Replace halogen downlights with energy-efficient LED',
    'Upgrade switchboard to modern safety standard',
    'Install safety switch (RCD) to protect circuits',
    'Run dedicated circuit for air conditioning unit',
    'Install garden lights with timer and sensor options'
  ],
  carpentry: [
    'Build new timber deck with treated pine or hardwood',
    'Construct pergola with optional shade sail attachments',
    'Install pre-made or custom kitchen cabinets',
    'Replace damaged door including frame if necessary',
    'Repair or replace window frame, repaint to match',
    'Install new fence including posts and rails'
  ]
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const prefix = randomItem(['0400', '0401', '0402', '0403', '0404', '0405', '0410', '0411', '0412', '0413', '0420', '0421', '0422', '0423', '0424', '0425', '0430', '0431', '0432', '0433', '0450', '0451', '0452']);
  return `${prefix} ${randomInt(100, 999)} ${randomInt(100, 999)}`;
}

function generateEmail(firstName: string, lastName: string): string {
  const domain = randomItem(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.au', 'bigpond.com', 'icloud.com']);
  const format = randomItem(['firstlast', 'first.last', 'flast', 'firstl']);
  
  switch (format) {
    case 'firstlast':
      return `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`;
    case 'first.last':
      return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
    case 'flast':
      return `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@${domain}`;
    case 'firstl':
      return `${firstName.toLowerCase()}${lastName.charAt(0).toLowerCase()}@${domain}`;
    default:
      return `${firstName.toLowerCase()}@${domain}`;
  }
}

interface AddressWithCoords {
  address: string;
  latitude: number;
  longitude: number;
}

function generateAddressWithCoords(): AddressWithCoords {
  const streetNumber = randomInt(1, 150);
  const street = randomItem(AUSTRALIAN_STREETS);
  const suburb = randomItem(QLD_SUBURBS);
  const latOffset = (Math.random() - 0.5) * 0.02;
  const lngOffset = (Math.random() - 0.5) * 0.02;
  return {
    address: `${streetNumber} ${street}, ${suburb.name} QLD ${suburb.postcode}`,
    latitude: suburb.lat + latOffset,
    longitude: suburb.lng + lngOffset
  };
}

function generateAddress(): string {
  return generateAddressWithCoords().address;
}

function getRandomDate(daysAgo: number, daysAhead: number): Date {
  const now = new Date();
  const offset = randomInt(-daysAgo, daysAhead);
  return new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
}

function getJobTitles(tradeType: string): string[] {
  switch (tradeType) {
    case 'plumbing': return PLUMBING_JOB_TITLES;
    case 'electrical': return ELECTRICAL_JOB_TITLES;
    case 'carpentry': return CARPENTRY_JOB_TITLES;
    default: return PLUMBING_JOB_TITLES;
  }
}

function getJobDescription(tradeType: string): string {
  const descriptions = JOB_DESCRIPTIONS[tradeType] || JOB_DESCRIPTIONS.plumbing;
  return randomItem(descriptions);
}

export async function seedMockData(userId: string, tradeType: string = 'plumbing') {
  console.log(`🌱 Seeding mock data for user ${userId} (${tradeType})...`);
  
  const results = {
    clients: 0,
    jobs: 0,
    quotes: 0,
    invoices: 0,
    receipts: 0,
    notifications: 0
  };

  try {
    let existingClients = await storage.getClients(userId);
    const existingJobs = await storage.getJobs(userId);
    const existingQuotes = await storage.getQuotes(userId);
    const existingInvoices = await storage.getInvoices(userId);
    
    // Check if we already have substantial mock data
    if (existingClients.length >= 10 && existingJobs.length >= 20 && existingQuotes.length >= 20 && existingInvoices.length >= 15) {
      console.log('✅ Mock data already exists');
      return { success: true, message: 'Mock data already exists', results };
    }

    // Use existing clients or create new ones
    let clients: any[] = [...existingClients];
    
    if (existingClients.length < 10) {
      const clientCount = 10 - existingClients.length;
      
      for (let i = 0; i < clientCount; i++) {
        const firstName = randomItem(AUSTRALIAN_FIRST_NAMES);
        const lastName = randomItem(AUSTRALIAN_LAST_NAMES);
        
        const client = await storage.createClient({
          userId,
          name: `${firstName} ${lastName}`,
          email: generateEmail(firstName, lastName),
          phone: generatePhone(),
          address: generateAddress(),
          notes: i === 0 ? 'VIP customer - always prioritize' : 
                 i === 1 ? 'Prefers morning appointments' :
                 i === 2 ? 'Has a dog - call before arriving' :
                 i === 3 ? 'Rental property - tenant contact required' :
                 i === 4 ? 'Regular maintenance contract' : ''
        });
        clients.push(client);
        results.clients++;
      }
      console.log(`✅ Created ${results.clients} new clients (total: ${clients.length})`);
    } else {
      console.log(`✅ Using ${clients.length} existing clients`);
    }

    // Create jobs if needed
    let jobs: any[] = [...existingJobs];
    const jobTitles = getJobTitles(tradeType);
    
    if (existingJobs.length < 15) {
      const jobsToCreate = 20 - existingJobs.length;
      
      for (let i = 0; i < jobsToCreate; i++) {
        const client = randomItem(clients);
        const status = i < 3 ? 'pending' : 
                       i < 6 ? 'scheduled' :
                       i < 9 ? 'in_progress' :
                       i < 15 ? 'done' : 'invoiced';
        
        const scheduledDate = status === 'pending' ? null :
                             status === 'scheduled' ? getRandomDate(0, 14) :
                             status === 'in_progress' ? getRandomDate(-1, 0) :
                             getRandomDate(-60, -1);
        
        const jobLocation = generateAddressWithCoords();
        const job = await storage.createJob({
          userId,
          clientId: client.id,
          title: randomItem(jobTitles),
          description: getJobDescription(tradeType),
          address: jobLocation.address,
          latitude: String(jobLocation.latitude),
          longitude: String(jobLocation.longitude),
          status: status as any,
          scheduledAt: scheduledDate,
          notes: i === 0 ? 'Urgent - customer has been waiting' :
                 i === 1 ? 'Parts ordered - arrive Wednesday' :
                 i === 2 ? 'Access via side gate' : ''
        });
        jobs.push(job);
        results.jobs++;
      }
      console.log(`✅ Created ${results.jobs} new jobs (total: ${jobs.length})`);
    } else {
      console.log(`✅ Using ${jobs.length} existing jobs`);
    }

    // Create quotes if needed
    let quotes: any[] = [...existingQuotes];
    
    if (existingQuotes.length < 15) {
      const quotesToCreate = 25 - existingQuotes.length;
      
      for (let i = 0; i < quotesToCreate; i++) {
        const client = randomItem(clients);
        const availableJobs = jobs.filter(j => j.status === 'pending' || j.status === 'scheduled');
        const job = i < 5 && availableJobs.length > 0 ? randomItem(availableJobs) : null;
        const status = i < 5 ? 'draft' : i < 13 ? 'sent' : i < 21 ? 'accepted' : 'declined';
        
        const rawSubtotal = randomInt(200, 3000);
        const { subtotal, gstAmount: gst, total } = calculateDocumentTotals([{ amount: rawSubtotal }]);

        const quoteNumber = await storage.generateQuoteNumber(userId);
        const quote = await storage.createQuote({
          userId,
          clientId: client.id,
          jobId: job?.id || null,
          number: quoteNumber,
          title: job?.title || randomItem(jobTitles) + ' Quote',
          description: getJobDescription(tradeType),
          status: status as any,
          subtotal: subtotal.toFixed(2),
          gstAmount: gst.toFixed(2),
          total: total.toFixed(2),
          validUntil: getRandomDate(7, 30),
          sentAt: status !== 'draft' ? getRandomDate(-14, -1) : null,
          acceptedAt: status === 'accepted' ? getRandomDate(-7, -1) : null,
          notes: 'Payment terms: 50% deposit, balance on completion'
        });
        quotes.push(quote);
        results.quotes++;

        const numLineItems = randomInt(2, 5);
        for (let j = 0; j < numLineItems; j++) {
          const qty = randomInt(1, 4);
          const unitPrice = randomInt(50, 500);
          await storage.createQuoteLineItem({
            quoteId: quote.id,
            description: j === 0 ? `${tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} labour` :
                         j === 1 ? 'Materials and supplies' :
                         j === 2 ? 'Call-out fee' :
                         'Additional works',
            quantity: qty.toString(),
            unitPrice: unitPrice.toFixed(2),
            total: (qty * unitPrice).toFixed(2),
            sortOrder: j
          });
        }
      }
      console.log(`✅ Created ${results.quotes} new quotes (total: ${quotes.length})`);
    } else {
      console.log(`✅ Using ${quotes.length} existing quotes`);
    }

    // Create invoices if needed
    let invoices: any[] = [...existingInvoices];
    
    if (existingInvoices.length < 12) {
      const invoicesToCreate = 20 - existingInvoices.length;
      
      for (let i = 0; i < invoicesToCreate; i++) {
        const client = randomItem(clients);
        const completedJobs = jobs.filter(j => j.status === 'done' || j.status === 'invoiced');
        const job = i < 8 && completedJobs.length > 0 ? randomItem(completedJobs) : null;
        
        const status = i < 3 ? 'draft' : 
                       i < 8 ? 'sent' : 
                       i < 16 ? 'paid' : 'overdue';
        
        const rawSubtotal = randomInt(150, 2500);
        const { subtotal, gstAmount: gst, total } = calculateDocumentTotals([{ amount: rawSubtotal }]);

        const invoiceNumber = await storage.generateInvoiceNumber(userId);
        const dueDate = status === 'overdue' ? getRandomDate(-30, -7) :
                        status === 'paid' ? getRandomDate(-30, -1) :
                        getRandomDate(7, 30);
        
        const invoice = await storage.createInvoice({
          userId,
          clientId: client.id,
          jobId: job?.id || null,
          number: invoiceNumber,
          title: job?.title || randomItem(jobTitles),
          description: getJobDescription(tradeType),
          status: status as any,
          subtotal: subtotal.toFixed(2),
          gstAmount: gst.toFixed(2),
          total: total.toFixed(2),
          dueDate,
          sentAt: status !== 'draft' ? getRandomDate(-14, -1) : null,
          paidAt: status === 'paid' ? getRandomDate(-7, -1) : null,
          notes: 'Thank you for your business!'
        });
        invoices.push(invoice);
        results.invoices++;

        const numLineItems = randomInt(1, 4);
        for (let j = 0; j < numLineItems; j++) {
          const qty = randomInt(1, 3);
          const unitPrice = randomInt(80, 400);
          await storage.createInvoiceLineItem({
            invoiceId: invoice.id,
            description: j === 0 ? 'Labour - as quoted' :
                         j === 1 ? 'Materials' :
                         'Additional items',
            quantity: qty.toString(),
            unitPrice: unitPrice.toFixed(2),
            total: (qty * unitPrice).toFixed(2),
            sortOrder: j
          });
        }
      }
      console.log(`✅ Created ${results.invoices} new invoices (total: ${invoices.length})`);
    } else {
      console.log(`✅ Using ${invoices.length} existing invoices`);
    }

    // Create receipts for paid invoices
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const existingReceipts = await storage.getReceipts(userId);
    
    if (existingReceipts.length < 15) {
      const targetReceipts = Math.min(20, paidInvoices.length);
      const receiptsToCreate = Math.max(0, targetReceipts - existingReceipts.length);
      
      for (let i = 0; i < receiptsToCreate && i < paidInvoices.length; i++) {
        const invoice = paidInvoices[i];
        const paymentMethod = randomItem(['card', 'bank_transfer', 'cash', 'tap_to_pay']);
        const receiptNumber = await storage.generateReceiptNumber(userId);
        
        await storage.createReceipt({
          userId,
          invoiceId: invoice.id,
          jobId: invoice.jobId || null,
          clientId: invoice.clientId,
          receiptNumber,
          amount: invoice.total,
          gstAmount: invoice.gstAmount || '0.00',
          subtotal: invoice.subtotal || '0.00',
          description: invoice.title || 'Payment received',
          paymentMethod,
          paymentReference: `REF-${randomInt(100000, 999999)}`,
          paidAt: invoice.paidAt || new Date(),
        });
        results.receipts++;
      }
      console.log(`✅ Created ${results.receipts} new receipts`);
    } else {
      console.log(`✅ Using ${existingReceipts.length} existing receipts`);
    }

    const notificationTypes = [
      { type: 'job_scheduled', title: 'Job Scheduled', message: 'A new job has been scheduled' },
      { type: 'quote_accepted', title: 'Quote Accepted', message: 'Client has accepted your quote' },
      { type: 'payment_received', title: 'Payment Received', message: 'Payment has been received' },
      { type: 'job_reminder', title: 'Job Reminder', message: 'You have a job scheduled for tomorrow' },
      { type: 'overdue_invoice', title: 'Overdue Invoice', message: 'An invoice is overdue for payment' }
    ];

    for (let i = 0; i < 8; i++) {
      const notif = randomItem(notificationTypes);
      await storage.createNotification({
        userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        relatedId: i < 4 ? randomItem(jobs).id : randomItem(invoices).id,
        relatedType: i < 4 ? 'job' : 'invoice',
        read: i > 3
      });
      results.notifications++;
    }
    console.log(`✅ Created ${results.notifications} notifications`);

    console.log('🎉 Mock data seeding complete!');
    return { success: true, message: 'Mock data created successfully', results };

  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
    throw error;
  }
}

export async function clearMockData(userId: string) {
  console.log(`🗑️ Clearing all data for user ${userId}...`);
  
  try {
    const receipts = await storage.getReceipts(userId);
    for (const receipt of receipts) {
      await storage.deleteReceipt(receipt.id, userId);
    }

    const invoices = await storage.getInvoices(userId);
    for (const invoice of invoices) {
      await storage.deleteInvoice(invoice.id, userId);
    }
    
    const quotes = await storage.getQuotes(userId);
    for (const quote of quotes) {
      await storage.deleteQuote(quote.id, userId);
    }
    
    const jobs = await storage.getJobs(userId);
    for (const job of jobs) {
      await storage.deleteJob(job.id, userId);
    }
    
    const clients = await storage.getClients(userId);
    for (const client of clients) {
      await storage.deleteClient(client.id, userId);
    }

    console.log('✅ All data cleared');
    return { success: true, message: 'All data cleared successfully' };
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}
