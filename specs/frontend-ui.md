# Frontend UI Specification

**Component:** Frontend User Interface
**Location:** `/src/routes`, `/src/lib/components`
**Dependencies:** API Routes, Types
**Status:** Planning

---

## Overview

Clean, modern single-page interface for Nightingale prescription calculator. Built with SvelteKit, Tailwind CSS, and lucide-svelte icons.

**Design Philosophy:**
- Clean and minimal
- No emojis or clutter
- Professional pharmacy aesthetic
- Light mode only
- Instant feedback with live preview
- Transparent AI workflow

---

## Page Structure

### Main Page (`/src/routes/+page.svelte`)

**Layout:**
```
┌─────────────────────────────────┐
│   Nightingale 💊 Calculator     │  Header
├─────────────────────────────────┤
│  Try: [Lisinopril] [Metformin] │  Quick Examples
├─────────────────────────────────┤
│  Drug Name: [______________]    │
│  SIG: [____________________]    │  Form
│  Days Supply: [___]             │
│  └─ 2x daily • 30 days • ~60    │  Live Preview
│  [Calculate Prescription]       │
├─────────────────────────────────┤
│  ⏳ Progress Steps (if loading) │  Progress
├─────────────────────────────────┤
│  📋 Results (if success)        │  Results
│     - Parsed SIG                │
│     - Packages Selected         │
│     - Warnings                  │
│     - [Copy] button             │
└─────────────────────────────────┘
```

---

## Components

### 1. PrescriptionForm (`PrescriptionForm.svelte`)

**Purpose:** Main input form with validation.

**Fields:**
- **Drug Name** - Text input with autocomplete styling
- **SIG** - Textarea for prescription instructions
- **Days Supply** - Number input (1-365)

**Features:**
- Client-side validation
- Clear error messages below fields
- Disabled state during submission
- Auto-focus on drug name

**Validation:**
```typescript
drugName: required, max 200 chars
sig: required, max 500 chars
daysSupply: required, 1-365, integer
```

---

### 2. LiveSIGPreview (`LiveSIGPreview.svelte`)

**Purpose:** Real-time AI interpretation preview as user types SIG.

**Display:**
- Small pill badge below SIG field
- Format: `"2x daily • 30 days • ~60 tablets"`
- Gray text when parsing
- Updates with debounce (500ms)

**Logic:**
- Call lightweight SIG parser (can use same AI endpoint with lower confidence threshold)
- Show only if SIG has 10+ characters
- Fade in/out transitions

**States:**
- Empty: Hidden
- Typing: Shows "..."
- Parsed: Shows interpretation
- Error: Shows nothing (fail silently)

**Example:**
```
SIG: "Take 1 tablet by mouth twice daily"
Preview: 💊 2x daily • 30 days • ~60 tablets
```

---

### 3. QuickExamples (`QuickExamples.svelte`)

**Purpose:** One-click example prescriptions for demos.

**Examples:**
1. **Lisinopril**
   - Drug: "Lisinopril 10mg"
   - SIG: "Take 1 tablet by mouth once daily"
   - Days: 30

2. **Metformin**
   - Drug: "Metformin 500mg"
   - SIG: "Take 1 tablet by mouth twice daily with meals"
   - Days: 90

3. **Insulin**
   - Drug: "Insulin Glargine"
   - SIG: "Inject 20 units subcutaneously once daily at bedtime"
   - Days: 30

**Display:**
- Horizontal row of buttons above form
- Small, subtle styling
- Text: "Try an example: [Lisinopril] [Metformin] [Insulin]"

---

### 4. ProgressStepper (`ProgressStepper.svelte`)

**Purpose:** Show AI workflow steps during processing.

**Steps:**
1. ✓ Parsing prescription...
2. ✓ Finding medications...
3. ⏳ Selecting packages...

**States:**
- Pending: Gray with spinner icon
- Complete: Green with checkmark icon
- Current: Blue with animated spinner

**Animation:**
- Steps appear sequentially
- Each step takes ~1-2 seconds
- Smooth transitions

**Icons (lucide-svelte):**
- Pending: `Loader` (animated)
- Complete: `CheckCircle`
- Error: `XCircle`

---

### 5. ResultsDisplay (`ResultsDisplay.svelte`)

**Purpose:** Show calculation results with reasoning and warnings.

**Sections:**

**A. Parsed SIG Summary**
```
📋 Prescription Breakdown
• Dose: 1 tablet
• Frequency: Twice daily
• Duration: 30 days
• Total Needed: 60 tablets
```

**B. Selected Packages Table**
```
┌────────────────────────────────────────────────┐
│ NDC           Package Size   Qty   Total Units │
├────────────────────────────────────────────────┤
│ 00069258741   30 tablets     2     60 tablets  │
└────────────────────────────────────────────────┘
```

**C. AI Reasoning Card**
```
🤖 Why This Selection
"Selected 2 bottles of 30 tablets to precisely match
the 60 tablet requirement with zero waste."
```

**D. Warnings (if any)**
```
⚠️ Low confidence (0.65) in SIG parsing
💡 Review parsed SIG for accuracy
```

**E. Copy Button**
- Small icon button (top-right of results)
- Copies results as formatted text
- Shows "Copied!" tooltip on click

---

### 6. PackageTable (`PackageTable.svelte`)

**Purpose:** Display selected packages in clean table format.

**Columns:**
- NDC (11-digit)
- Generic Name
- Package Size (e.g., "30 tablets")
- Quantity
- Total Units

**Styling:**
- Bordered table
- Hover effects on rows
- Monospace font for NDC

---

### 7. WarningCard (`WarningCard.svelte`)

**Purpose:** Display warnings with appropriate severity.

**Props:**
- `type`: WarningType
- `severity`: 'info' | 'warning' | 'error'
- `message`: string
- `suggestion?`: string

**Styling by Severity:**
- Info: Blue background, info icon
- Warning: Yellow background, alert icon
- Error: Red background, X icon

**Icons:**
- Info: `Info`
- Warning: `AlertCircle`
- Error: `XCircle`

---

### 8. ErrorAlert (`ErrorAlert.svelte`)

**Purpose:** Display error messages when calculation fails.

**Display:**
- Red border card
- Error icon
- Error code and message
- "Try again" button

---

## Styling

### Tailwind Configuration

**Color Palette:**
- Primary: Blue (medical/professional)
- Success: Green
- Warning: Yellow/Orange
- Error: Red
- Neutral: Gray scale

**Typography:**
- Headings: `font-semibold`
- Body: `font-normal`
- Monospace: `font-mono` (for NDCs)

**Spacing:**
- Consistent: `p-4`, `gap-4`, `space-y-4`
- Form fields: `mb-4`

**Components:**
- Rounded corners: `rounded-lg`
- Shadows: `shadow-sm` (subtle)
- Borders: `border border-gray-300`

---

## Icons (lucide-svelte)

**Used Icons:**
- `Pill` - Medication/drug icon
- `CheckCircle` - Success
- `XCircle` - Error
- `AlertCircle` - Warning
- `Info` - Information
- `Loader` - Loading spinner (animated)
- `Copy` - Copy button
- `Check` - Copy confirmation

**Installation:**
```bash
npm install lucide-svelte
```

**Usage:**
```svelte
<script>
  import { Pill, CheckCircle, Loader } from 'lucide-svelte';
</script>

<Pill class="w-5 h-5 text-blue-500" />
```

---

## State Management

**Page-Level State:**
```typescript
let formData: PrescriptionInput = { drugName: '', sig: '', daysSupply: 30 };
let isLoading = false;
let currentStep = 0;
let result: CalculationResult | null = null;
let error: string | null = null;
```

**Form Submission Flow:**
```typescript
async function handleSubmit() {
  isLoading = true;
  currentStep = 0;
  error = null;
  result = null;

  // Step 1: Parsing
  currentStep = 1;
  await sleep(800);

  // Step 2: Finding
  currentStep = 2;
  await sleep(800);

  // Step 3: Selecting
  currentStep = 3;

  const response = await fetch('/api/calculate', {
    method: 'POST',
    body: JSON.stringify(formData)
  });

  const data = await response.json();

  if (data.success) {
    result = data.data;
  } else {
    error = data.error.message;
  }

  isLoading = false;
}
```

---

## Responsive Design

**Breakpoints:**
- Mobile: < 640px (stack vertically)
- Tablet: 640px - 1024px (comfortable single column)
- Desktop: > 1024px (max-width: 800px centered)

**Mobile Adjustments:**
- Smaller text
- Stack form fields
- Compress table (show fewer columns)

---

## Copy Functionality

**Implementation:**
```typescript
async function copyResults() {
  const text = `
Nightingale Calculation Results

Drug: ${formData.drugName}
SIG: ${formData.sig}
Days Supply: ${formData.daysSupply}

Quantity Needed: ${result.totalQuantityNeeded} ${result.unit}

Selected Packages:
${result.selectedPackages.map(pkg =>
  `- ${pkg.package.ndc}: ${pkg.quantity}x ${pkg.package.packageSize} ${result.unit}`
).join('\n')}

Total Dispensed: ${result.totalUnitsDispensed} ${result.unit}
  `.trim();

  await navigator.clipboard.writeText(text);
  showCopiedTooltip();
}
```

---

## Implementation Checklist

- [ ] Install Tailwind CSS and configure
- [ ] Install lucide-svelte
- [ ] Create component directory structure
- [ ] Implement PrescriptionForm with validation
- [ ] Implement LiveSIGPreview with debounced updates
- [ ] Implement QuickExamples with pre-filled data
- [ ] Implement ProgressStepper with animations
- [ ] Implement ResultsDisplay with all sections
- [ ] Implement PackageTable
- [ ] Implement WarningCard with severity styling
- [ ] Implement ErrorAlert
- [ ] Add copy-to-clipboard functionality
- [ ] Test responsive design on mobile/tablet/desktop
- [ ] Verify all icons display correctly
- [ ] Test with API endpoints

---

## Dependencies

```json
{
  "tailwindcss": "^3.4.0",
  "@tailwindcss/forms": "^0.5.0",
  "lucide-svelte": "^0.300.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0"
}
```

---

## Success Criteria

✅ Clean, professional UI without clutter
✅ Live SIG preview updates as user types
✅ Quick example buttons populate form instantly
✅ Progress stepper shows AI workflow transparently
✅ Results display all calculation details clearly
✅ Copy button works and provides feedback
✅ Warnings display with appropriate severity
✅ Error handling is clear and actionable
✅ Responsive on mobile, tablet, and desktop
✅ No emojis in production UI (only in specs for clarity)
✅ All icons from lucide-svelte work correctly
