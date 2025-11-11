# Nightingale - Technical Specifications

**Project:** NDC Packaging & Quantity Calculator
**Code Name:** Nightingale
**Organization:** Foundation Health
**Tech Stack:** TypeScript + SvelteKit + OpenAI + GCP

---

## 1. Core Components

### 1.1 Frontend Layer (`/src/routes`, `/src/lib/components`)
**Responsibility:** User interface and interaction

- **Prescription Input Form**: Accepts drug name/NDC, SIG (natural language), and days' supply
- **Results Display**: Shows AI reasoning, calculated quantities, selected NDCs, and warnings
- **Conversational UI**: Presents AI explanations in human-readable format
- **Error/Warning Cards**: Highlights inactive NDCs, overfills/underfills, and dosage form mismatches

**Key Features:**
- Real-time validation
- Responsive design (desktop/tablet)
- Accessible UI components

---

### 1.2 AI Service Layer (`/src/lib/services/ai`)
**Responsibility:** Natural language understanding and intelligent decision-making

**Components:**
- **SIG Parser**: Uses OpenAI to extract structured data from prescription instructions
  - Input: Natural language SIG (e.g., "Take 1 tablet by mouth twice daily")
  - Output: Structured data (dose, frequency, duration, route, special instructions)
  - Includes confidence scores and reasoning

- **NDC Selector**: AI-powered selection of optimal NDC(s) from valid options
  - Considers package sizes, quantity needed, cost optimization
  - Provides natural language justification for selections

- **Error Advisor**: Contextual guidance for mismatches and warnings
  - Suggests alternatives for inactive NDCs
  - Explains dosage form discrepancies
  - Provides actionable next steps

**Technology:** OpenAI API (GPT-4 or similar)

---

### 1.3 API Integration Layer (`/src/lib/services/external`)
**Responsibility:** Communication with external drug databases

**Components:**
- **RxNorm Service**: Drug normalization to RxCUI
  - `/rxcui`: Normalize drug name to RxCUI
  - `/related`: Get related drug concepts

- **FDA NDC Directory Service**: Retrieve valid NDCs and package information
  - `/package`: Get package sizes for NDCs
  - `/status`: Check NDC active/inactive status
  - `/properties`: Retrieve dosage form, strength, manufacturer

**Features:**
- Error handling and retry logic
- Response caching (to reduce API calls)
- Rate limiting compliance

---

### 1.4 Calculation Engine (`/src/lib/services/calculator`)
**Responsibility:** Quantity computation and package optimization

**Components:**
- **Quantity Calculator**: Computes total units needed
  - Parses dose × frequency × duration
  - Handles unit conversions (tablets, mL, units, etc.)
  - Accounts for special dosing schedules

- **Package Optimizer**: Selects optimal NDC packages
  - Minimizes overfill/underfill
  - Considers multi-pack scenarios
  - Calculates cost-effectiveness when data available

**Output:** Structured dispense instructions with package breakdown

---

### 1.5 Data Models & Types (`/src/lib/types`)
**Responsibility:** TypeScript interfaces and type definitions

**Core Types:**
```typescript
// Prescription input
PrescriptionInput {
  drugName: string
  ndc?: string
  sig: string
  daysSupply: number
}

// Parsed SIG structure
ParsedSIG {
  dose: number
  unit: string (tablet, mL, unit, etc.)
  frequency: string | number
  duration: number
  route?: string
  specialInstructions?: string
  confidence: number
  reasoning: string
}

// NDC Package
NDCPackage {
  ndc: string
  packageSize: number
  dosageForm: string
  strength: string
  manufacturer: string
  isActive: boolean
}

// Calculation Result
CalculationResult {
  totalQuantity: number
  selectedPackages: NDCPackage[]
  overfill: number
  reasoning: string
  warnings: Warning[]
}
```

---

### 1.6 API Routes (`/src/routes/api`)
**Responsibility:** Backend endpoints for frontend consumption

**Endpoints:**
- `POST /api/calculate`: Main calculation endpoint
  - Accepts PrescriptionInput
  - Orchestrates AI parsing, API calls, calculations
  - Returns CalculationResult

- `GET /api/validate-ndc/:ndc`: Quick NDC validation
- `GET /api/health`: Health check for deployment monitoring

---

## 2. Directory Structure

```
ndc-calc/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Main prescription input page
│   │   ├── +layout.svelte            # App layout wrapper
│   │   └── api/
│   │       ├── calculate/
│   │       │   └── +server.ts        # Main calculation endpoint
│   │       └── validate-ndc/
│   │           └── [ndc]/+server.ts  # NDC validation endpoint
│   │
│   ├── lib/
│   │   ├── components/
│   │   │   ├── PrescriptionForm.svelte
│   │   │   ├── ResultsDisplay.svelte
│   │   │   ├── AIReasoningCard.svelte
│   │   │   ├── WarningCard.svelte
│   │   │   └── PackageBreakdown.svelte
│   │   │
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── sigParser.ts      # OpenAI SIG parsing
│   │   │   │   ├── ndcSelector.ts    # AI-powered NDC selection
│   │   │   │   └── errorAdvisor.ts   # Contextual error guidance
│   │   │   │
│   │   │   ├── external/
│   │   │   │   ├── rxnorm.ts         # RxNorm API client
│   │   │   │   └── fdaNdc.ts         # FDA NDC Directory client
│   │   │   │
│   │   │   └── calculator/
│   │   │       ├── quantityCalc.ts   # Quantity calculations
│   │   │       └── packageOptimizer.ts # Package selection logic
│   │   │
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript type definitions
│   │   │
│   │   └── utils/
│   │       ├── validators.ts         # Input validation helpers
│   │       └── formatters.ts         # Output formatting utilities
│   │
│   └── app.html                      # HTML template
│
├── static/                           # Static assets (logos, etc.)
├── tests/                            # Unit and integration tests
│   ├── unit/
│   └── integration/
│
├── .env.example                      # Environment variables template
├── svelte.config.js                  # SvelteKit configuration
├── vite.config.ts                    # Vite configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies
└── README.md                         # Project documentation
```

---

## 3. Dependencies

### 3.1 Core Framework
```json
{
  "@sveltejs/kit": "^2.0.0",
  "@sveltejs/adapter-auto": "^3.0.0",
  "svelte": "^4.0.0",
  "vite": "^5.0.0"
}
```

### 3.2 AI & LLM
```json
{
  "openai": "^4.0.0"
}
```

### 3.3 API & HTTP
```json
{
  "axios": "^1.6.0"
}
```

### 3.4 TypeScript & Type Safety
```json
{
  "typescript": "^5.0.0",
  "@types/node": "^20.0.0",
  "zod": "^3.22.0"
}
```

### 3.5 Development & Testing
```json
{
  "@playwright/test": "^1.40.0",
  "vitest": "^1.0.0",
  "@testing-library/svelte": "^4.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0",
  "prettier-plugin-svelte": "^3.0.0"
}
```

### 3.6 UI & Styling (Optional)
```json
{
  "tailwindcss": "^3.0.0",
  "@tailwindcss/forms": "^0.5.0"
}
```

---

## 4. Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# API Endpoints
RXNORM_API_URL=https://rxnav.nlm.nih.gov/REST
FDA_NDC_API_URL=https://api.fda.gov/drug/ndc.json

# GCP (for production deployment)
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# App Config
NODE_ENV=development
PUBLIC_APP_NAME=Nightingale
```

---

## 5. Data Flow Architecture

```
User Input (Drug + SIG + Days Supply)
    ↓
[Frontend] Prescription Form
    ↓
[API Route] POST /api/calculate
    ↓
[AI Service] Parse SIG → Structured Data
    ↓
[External API] Normalize Drug → RxCUI (RxNorm)
    ↓
[External API] Get Valid NDCs → Package Data (FDA)
    ↓
[Calculator] Compute Quantity + Optimize Packages
    ↓
[AI Service] Select Best NDC(s) + Generate Reasoning
    ↓
[API Route] Return CalculationResult
    ↓
[Frontend] Display Results + AI Explanations + Warnings
```

---

## 6. Key Design Decisions

### 6.1 AI-First Approach
- **Why:** The complexity of natural language SIG parsing and intelligent NDC selection requires LLM capabilities
- **Benefit:** Handles ambiguity, provides human-readable explanations, learns from edge cases

### 6.2 SvelteKit for Full-Stack
- **Why:** Unified TypeScript codebase, excellent performance, simple API routes
- **Benefit:** Faster development, type safety across frontend/backend

### 6.3 Stateless Architecture
- **Why:** Demo-focused, no user accounts or prescription history needed initially
- **Benefit:** Simpler deployment, faster development, easy to scale

### 6.4 API Caching Strategy
- **Why:** RxNorm and FDA APIs can be slow; reduce redundant calls
- **Benefit:** Improved response times, lower costs

---

## 7. Success Criteria for Demo

1. **AI Parsing Accuracy**: Successfully parse 90%+ of common SIG patterns
2. **Response Time**: Complete calculation in < 3 seconds
3. **Conversational UX**: AI reasoning is clear and helpful to users
4. **Error Handling**: Gracefully handle inactive NDCs and edge cases
5. **Visual Polish**: Clean, professional UI suitable for pharmacy professionals

---

## Next Steps

1. **Phase 1**: Set up SvelteKit project + basic UI
2. **Phase 2**: Implement AI SIG parser with OpenAI
3. **Phase 3**: Integrate RxNorm and FDA NDC APIs
4. **Phase 4**: Build calculation engine and package optimizer
5. **Phase 5**: Polish UI and add AI reasoning display
6. **Phase 6**: Testing and GCP deployment
