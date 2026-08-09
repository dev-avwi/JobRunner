# JobRunner Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from productivity tools like Linear, Notion, and Asana, combined with professional service platforms. This utility-focused app prioritizes efficiency and learnability for busy tradespeople.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Light mode: 220 15% 15% (charcoal blue)
- Dark mode: 210 20% 95% (light blue-white)

**Secondary Colors:**
- Success: 145 65% 45% (professional green)
- Warning: 35 90% 55% (amber)
- Danger: 5 85% 55% (red)

**Backgrounds:**
- Light mode: 0 0% 98% (off-white)
- Dark mode: 220 15% 8% (deep charcoal)

### Typography
**Font Family:** Inter via Google Fonts CDN
- Headings: 600-700 weight
- Body text: 400-500 weight
- Small text/labels: 400 weight
- Mobile: 14px base, Desktop: 16px base

### Layout System
**Spacing Scale:** Consistent rhythm using gap-4 and space-y-6
- Component spacing within cards: gap-3, gap-4
- Section spacing (vertical): space-y-4 on mobile, space-y-6 on desktop (md:space-y-6)
- Grid gaps: gap-4 for all responsive grids
- Card padding: p-4 on mobile, p-6 on desktop (md:p-6)
- Page container: p-4 md:p-6 for all list pages

**Responsive Grid Patterns:**
- Mobile: 1 column (grid-cols-1)
- Tablet: 2 columns (sm:grid-cols-2 or md:grid-cols-2)
- Desktop: 3 columns (lg:grid-cols-3)
- Always use gap-4 for consistent spacing between grid items

### Component Library

**Navigation:**
- Mobile: Bottom tab bar with 5 icons (Dashboard, Jobs, Clients, Quotes, Calendar)
- Desktop: Collapsible sidebar with same sections
- Icons from Heroicons (outline style)

**Cards & Containers:**
- Use shadcn Card component for all card-based layouts
- Card headers: `<CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">`
- Card content: Standard padding via CardContent (p-6)
- Hover states: Apply `hover-elevate active-elevate-2` to interactive cards
- Never nest Cards within Cards
- Subtle shadows: shadow-sm (handled by Card component)
- Rounded corners: rounded-lg (handled by Card component)
- Clean borders in light mode, subtle outlines in dark mode (handled by Card component)

**Quick Action Cards Pattern:**
- Use Card + Button composition for accessibility
- Button: `variant="ghost"` with `className="w-full h-auto p-6 flex flex-col items-center gap-3 text-center hover:bg-transparent no-default-hover-elevate no-default-active-elevate"`
- Card handles hover/active elevation via `hover-elevate active-elevate-2`
- Icon container: `w-14 h-14 rounded-xl` with background color
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

**Forms:**
- Single-column layouts on mobile
- Two-column on desktop for longer forms
- Prominent CTAs with primary color
- Clear field labels and validation states

**Data Tables:**
- Card-based layout on mobile (stacked)
- Traditional table on desktop
- Status badges with appropriate colors
- Quick action buttons (outline style)

**Buttons:**
- Primary: Solid background with primary color
- Secondary: Outline style with transparent background
- When placed over images: Use outline variant with backdrop-blur

## Mobile-First Considerations
- Touch-friendly 44px minimum tap targets
- Swipe gestures for job status updates
- Pull-to-refresh on list views
- Floating action buttons for primary actions

## Professional Aesthetics
- Clean, minimal interface with ample whitespace
- Consistent iconography throughout
- Professional color scheme suitable for business use
- Clear visual hierarchy with proper contrast ratios
- Subtle animations only for state changes and loading

## Images
**No large hero images required** - This is a utility-focused business application. Use:
- Small avatar placeholders for clients
- Job photo thumbnails in cards
- Company logo upload in settings
- Icon-based visual hierarchy instead of decorative imagery

The design emphasizes functionality and efficiency over visual flair, ensuring tradespeople can quickly complete tasks and manage their business effectively.

---

## JobRunner UX Checklist (For Every Screen)

**This is the design bible. If a screen breaks even one rule, fix it.**

### 1. Clarity Check
Every screen must answer these 3 questions in under 1 second:

**What is this screen?**
- Clear title (Jobs, Quote #1012, Dashboard, Photos)
- No ambiguous names
- Breadcrumbs or back button always visible

**What can I do here?**
- Actions must be obvious (Add Job, Add Photo, Send Invoice)
- Avoid hidden actions or long menus
- Only 1–3 primary actions per screen

**What should I do NEXT?**
- Highlighted primary button ("Create Quote", "Mark Job Complete")
- Progress indicators (Quote → Job → Invoice)

*If a tradie hesitates or looks confused → UI failed.*

### 2. Tap Count Rules
**Absolute rule: no common task should take more than 5 taps.**

| Task | Max Taps |
|------|----------|
| Create a job | ≤ 3 taps |
| Add photos | 1 tap |
| Send invoice | ≤ 3 taps |
| Mark job complete | 1–2 taps |
| Assign job | ≤ 3 taps |

*If any workflow takes too long → redesign.*

### 3. One-Hand Usability
Tradies often use the app in a van, on ladders, holding tools, wearing gloves, with dirty hands.

- Buttons must be large (44px minimum)
- Primary actions at the bottom (thumb zone)
- No tiny icons
- No text smaller than 14–15px
- Actions reachable with thumb only

*If a tradie can't operate it with one hand → fail.*

### 4. Speed & Performance Check
Every screen must load under 1 second (goal), under 2 seconds (absolute max).

- Skeleton loaders (never show blank white screens)
- Preload common data (jobs, clients)
- Do NOT fetch 10,000 records at once
- Use infinite scroll or pagination

*Speed is your weapon.*

### 5. Visual Hierarchy
Screens must have a clear visual "flow":

- Big title at top
- Primary action = bold coloured button
- Secondary = outlined or grey
- Group related items into cards
- Important info = top; details = bottom
- Avoid clutter & dense data

### 6. Reduce Cognitive Load
Tradies don't want to THINK — they want to DO.

- No more than 6–8 elements per screen
- Avoid long forms
- Use defaults wherever possible
- Auto-fill data when possible
- Turn complex tasks into guided steps
- Use icons AND labels (not icons alone)

*Make everything "obvious at a glance."*

### 7. Confirmation & Feedback
Every action MUST show feedback:

- "Saved ✓"
- "Quote sent ✓"
- "Invoice paid 💰"
- "Photo uploaded ✓"

*Micro-feedback builds trust.*

### 8. Error-Proofing
Prevent mistakes BEFORE they happen:

- Auto-save everything
- Warn if leaving unsaved screen
- Prevent duplicate jobs
- Validate fields instantly ("Invalid email")
- Background syncing so users never lose data
- Must work offline, with auto sync later

### 9. Design Language
Ensure consistency across all screens:

**Colours:**
- Primary = brand colour
- Secondary = neutral
- Error = red
- Success = green
- Info = blue

**Spacing:**
- Use uniform margins (8, 12, 16, 24 px grid)

**Components:**
- Use the SAME buttons, cards, lists, form fields, headings

*Consistency = professionalism.*

### 10. AI Interaction Check
If the screen uses AI:

- AI results ALWAYS editable
- Show a "thinking" animation, not loading spinner
- Suggest 2–3 alternate outputs
- Use simple tradie language, not corporate language
- Allow "Regenerate"
- AI should not replace user control — only speed things up

*If AI makes tradie type MORE → fail.*

### 11. Offline-First Check
Every screen must:

- Save offline instantly
- Show offline status
- Sync cleanly when back online
- NEVER lose data

**Test:** Put phone in airplane mode. Add job, photos, notes. Turn off airplane mode. All should sync automatically.

*This alone beats 80% of competitor apps.*

### 12. Accessibility & Environment Check
Tradies use the app in harsh conditions (sunlight, dust, glare, on roofs, in rain).

- High contrast mode
- Large tap areas
- Avoid light grey text
- Support dark mode
- Vibrations on send/complete
- Buttons usable with wet/dirty hands

### 13. Security Check
Every screen handling user data must:

- Auto-lock after X minutes
- Hide sensitive data in multitask preview
- Enforce secure API calls
- Validate input
- Protect payments & invoices

### 14. Predictability Rule
Every user action should do EXACTLY what they expect.

- Save should SAVE
- Send should SEND
- Back should go back, not delete

*No weird behaviour. No hidden surprises.*

---

## The 6-Second Test
After building any screen, ask:

**If a tradie opened this screen for the first time, could he:**
1. Understand what he's looking at
2. Know what to do next
3. Complete the task in under 6 seconds

**If the answer is not YES → the screen is not ready.**