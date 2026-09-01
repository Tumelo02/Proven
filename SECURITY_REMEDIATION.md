# Proven Platform - Security Remediation Code Examples

This document provides implementation examples for addressing the identified vulnerabilities.

---

## 1. Environment Variables & Secrets Management

### Before (Vulnerable)
```env
# .env.local (COMMITTED TO GIT - DANGEROUS!)
NEXT_PUBLIC_SUPABASE_URL=https://dbloopmalxgwfecptvev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### After (Secure)

**Step 1: Create `.env.example`**
```env
# .env.example
# TEMPLATE ONLY. Never commit real keys here.
# Copy to .env.local and fill in values from Supabase Settings -> API Keys

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Step 2: Update `.gitignore`**
```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.production.local

# Secrets
*.key
*.pem
secrets.json
```

**Step 3: Add to `.husky/pre-commit`**
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Prevent committing sensitive files
if git diff --cached --name-only | grep -E "\.(env|key|pem)(\.(local|production))?$"; then
  echo "❌ Error: Attempted to commit sensitive file (.env, .key, etc.)"
  echo "Make sure to add these files to .gitignore"
  exit 1
fi

npm run lint
```

**Step 4: Add pre-commit git-secrets hook**
```bash
# Install git-secrets
brew install git-secrets  # macOS
# or
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets && make install

# Initialize for repo
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' # JWT pattern
```

**Step 5: Vercel Secrets Management**
```bash
# Set secrets in Vercel (via CLI or dashboard)
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL

# Verify
vercel env ls
```

**Step 6: Clean Git History**
```bash
# WARNING: This rewrites history. Coordinate with team.
# 1. Create backup branch first
git branch backup

# 2. Remove .env.local from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch app/.env.local supabase/.env.local' \
  --prune-empty --tag-name-filter cat -- --all

# 3. Clean reflogs
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Force push (carefully!)
git push origin --force --all
git push origin --force --tags

# 5. Notify team to re-clone
```

---

## 2. Remove Debug Endpoints

### Before
```typescript
// app/src/app/api/debug/profile/route.ts (VULNERABLE)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({
    user,
    environment: process.env,
    headers: Object.fromEntries(request.headers),
  });
}
```

### After

**Option 1: Remove Entirely**
```bash
rm -rf app/src/app/api/debug/
```

**Option 2: Conditional Build**
```typescript
// app/src/app/api/debug/profile/route.ts
import { NextResponse } from 'next/server';

if (process.env.NODE_ENV === 'production') {
  export const runtime = 'nodejs';
  export async function GET() {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }
} else {
  // Debug endpoint only in development
  import { createClient } from '@/lib/supabase/server';
  
  export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return NextResponse.json({
      user: user?.id,
      email: user?.email,
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Option 3: Protected with Admin Check**
```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Only platform admins can access
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user?.id)
    .single();
  
  if (!profile?.is_platform_admin) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  
  // Return debug info
  return NextResponse.json({
    user: user?.id,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 3. Fix Content Security Policy

### Before (Unsafe)
```json
{
  "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
}
```

### After (Secure with Nonce)

**Step 1: Create CSP Middleware**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export function middleware(request: NextRequest) {
  // Generate nonce for this request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  const csp = [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.vercel-analytics.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://*.supabase.co https://cdn.jsdelivr.net",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel-analytics.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join('; ');

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-CSP-Nonce', nonce);
  
  return response;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
```

**Step 2: Create CSP Context Provider**
```typescript
// lib/csp-context.tsx
import { createContext, useContext } from 'react';
import { headers } from 'next/headers';

const CSPContext = createContext<{ nonce?: string }>({});

export function CSPProvider({ children }: { children: React.ReactNode }) {
  const headersList = headers();
  const nonce = headersList.get('x-csp-nonce') || '';
  
  return (
    <CSPContext.Provider value={{ nonce }}>
      {children}
    </CSPContext.Provider>
  );
}

export function useCSP() {
  return useContext(CSPContext);
}
```

**Step 3: Use in Layout**
```typescript
// app/src/app/layout.tsx
import { CSPProvider } from '@/lib/csp-context';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <CSPProvider>{children}</CSPProvider>
      </body>
    </html>
  );
}
```

**Step 4: Update Vercel Config**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; upgrade-insecure-requests; block-all-mixed-content"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
        }
      ]
    }
  ]
}
```

---

## 4. Implement Rate Limiting

### Installation
```bash
npm install @upstash/ratelimit @upstash/redis
```

### Implementation

**Step 1: Create Rate Limit Utility**
```typescript
// lib/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Sign-in: 5 attempts per 15 minutes per IP
export const signInLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:signin',
});

// API endpoints: 100 requests per minute per user
export const apiLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'ratelimit:api',
});

// Document upload: 10 per hour per user
export const uploadLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: 'ratelimit:upload',
});

export async function getClientIP(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         h.get('x-real-ip') ||
         'unknown';
}

export class RateLimitError extends Error {
  constructor(
    public retryAfter: number,
    message = 'Too many requests. Please try again later.'
  ) {
    super(message);
  }
}
```

**Step 2: Apply to Sign-In**
```typescript
// app/src/app/(auth)/actions.ts
import { signInLimit, getClientIP, RateLimitError } from '@/lib/rateLimit';

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const ip = await getClientIP();

  // Rate limit check
  const { success, limit, reset, remaining } = await signInLimit.limit(
    `${email.toLowerCase()}:${ip}`
  );
  
  if (!success) {
    const seconds = Math.ceil((reset - Date.now()) / 1000);
    throw new RateLimitError(
      seconds,
      `Too many sign-in attempts. Try again in ${seconds} seconds.`
    );
  }

  if (!email || !password) {
    return { error: 'Enter your email address and password.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ 
    email, 
    password 
  });

  // ... rest of implementation
}
```

**Step 3: Apply to Document Upload**
```typescript
// app/src/app/businesses/documents.ts
import { uploadLimit, getClientIP } from '@/lib/rateLimit';

export async function attachDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: 'Not authenticated.' };

  // Rate limit per user
  const { success } = await uploadLimit.limit(`upload:${user.id}`);
  if (!success) {
    return { error: 'Too many uploads. Try again in 1 hour.' };
  }

  // ... rest of implementation
}
```

---

## 5. Input Validation with Zod

### Installation
```bash
npm install zod
```

### Implementation

**Step 1: Create Validation Schema**
```typescript
// lib/validation.ts
import { z } from 'zod';

// Email with disposable provider blocklist
const DISPOSABLE_EMAILS = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
];

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email is too long')
  .toLowerCase()
  .refine(
    (email) => {
      const domain = email.split('@')[1];
      return !DISPOSABLE_EMAILS.includes(domain);
    },
    'Disposable email addresses are not allowed'
  );

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(255, 'Password is too long')
  .regex(/[a-z]/, 'Must include lowercase letters')
  .regex(/[A-Z]/, 'Must include uppercase letters')
  .regex(/[0-9]/, 'Must include numbers')
  .regex(/[^A-Za-z0-9]/, 'Must include special characters (!@#$%^&*)');

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .refine((slug) => !slug.startsWith('-') && !slug.endsWith('-'), 
    'Slug cannot start or end with a hyphen');

export const businessNameSchema = z
  .string()
  .min(1, 'Business name is required')
  .max(255, 'Business name is too long')
  .trim()
  .refine((name) => name.length > 0, 'Business name cannot be empty');

export const redirectSchema = z
  .string()
  .optional()
  .refine((url) => {
    if (!url) return true;
    if (!url.startsWith('/')) return false;
    if (url.startsWith('//')) return false; // No protocol-relative URLs
    const allowed = ['/dashboard', '/business', '/funder', '/admin'];
    return allowed.some(p => url.startsWith(p));
  }, 'Invalid redirect URL');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  next: redirectSchema,
});

export const signUpSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(255),
  email: emailSchema,
  password: passwordSchema,
});
```

**Step 2: Update Actions to Use Validation**
```typescript
// app/src/app/(auth)/actions.ts
import { signInSchema, signUpSchema } from '@/lib/validation';
import { z } from 'zod';

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    const input = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      next: String(formData.get('next') ?? ''),
    };

    const validated = signInSchema.parse(input);
    
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      if (error.status === 400 || error.code === 'invalid_credentials') {
        await recordFailedSignIn(validated.email);
        return { error: 'Email or password is incorrect.' };
      }
      return { error: `Sign in failed. Please try again.` };
    }

    // ... rest of implementation
    redirect(validated.next || '/dashboard');
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { error: e.errors[0]?.message || 'Invalid input.' };
    }
    return { error: 'An unexpected error occurred.' };
  }
}
```

---

## 6. Secure File Upload

### Installation
```bash
npm install file-type
```

### Implementation
```typescript
// app/src/app/businesses/documents.ts
import FileType from 'file-type';

const ACCEPTED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const MAX_BYTES = 5 * 1024 * 1024; // Reduced from 10 MB

const MAGIC_NUMBERS = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // + "WEBP"
  'image/heic': [0x66, 0x74, 0x79, 0x70], // ftyp
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
};

export async function attachDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const transactionId = String(formData.get('transaction_id') ?? '');
  const businessId = String(formData.get('business_id') ?? '');
  const file = formData.get('file');

  if (!transactionId || !businessId) {
    return { error: 'Missing transaction.' };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to attach.' };
  }

  // Check declared MIME type
  if (!ACCEPTED_MIMETYPES.has(file.type)) {
    return {
      error: 'File type not accepted. Use JPG, PNG, WEBP, HEIC, or PDF.',
    };
  }

  // Check file size
  if (file.size > MAX_BYTES) {
    return {
      error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 5 MB.`,
    };
  }

  // Verify magic bytes (file signature)
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  try {
    const fileType = await FileType.fromBuffer(buffer);
    
    if (!fileType || !ACCEPTED_MIMETYPES.has(fileType.mime)) {
      return {
        error: 'File content does not match its type. Please try another file.',
      };
    }

    // Additional check for PDF embedded JavaScript
    if (fileType.mime === 'application/pdf') {
      const pdfText = new TextDecoder().decode(bytes.slice(0, 10000));
      if (pdfText.includes('/JavaScript') || pdfText.includes('/AA')) {
        return {
          error: 'PDF files with JavaScript are not allowed.',
        };
      }
    }
  } catch (e) {
    return { error: 'Could not verify file type. Please try another file.' };
  }

  const supabase = await createClient();
  const path = `${businessId}/${crypto.randomUUID()}-${safeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from('proofs')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: `Upload failed. Please try again.` };
  }

  // ... rest of implementation
}

/** Sanitize filename - allow only safe characters */
function safeName(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, '_')      // Replace unsafe chars
    .replace(/\s+/g, '_')             // Replace spaces
    .replace(/_{2,}/g, '_')           // Collapse underscores
    .slice(0, 100) 
    || 'receipt';
}
```

---

## 7. Session Timeout Implementation

```typescript
// lib/session.ts
import { createClient } from '@/lib/supabase/server';

const SESSION_MAX_AGE = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before expiry

export async function checkSessionValidity() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return { valid: false, expired: true };
  
  const sessionAge = Date.now() - (session.created_at ? new Date(session.created_at).getTime() : 0);
  
  return {
    valid: sessionAge < SESSION_MAX_AGE,
    expired: sessionAge >= SESSION_MAX_AGE,
    expiringSoon: sessionAge >= (SESSION_MAX_AGE - SESSION_WARNING_TIME),
    timeRemaining: Math.max(0, SESSION_MAX_AGE - sessionAge),
  };
}

export async function enforceSessionTimeout() {
  const { valid, expired } = await checkSessionValidity();
  
  if (expired) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/sign-in?reason=session-expired');
  }
  
  return valid;
}

// Use in middleware
export async function middleware(request: NextRequest) {
  const sessionValid = await enforceSessionTimeout();
  
  if (!sessionValid && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next({ request });
}
```

---

## 8. Audit Logging Improvements

```typescript
// lib/audit.ts
import crypto from 'crypto';

/**
 * Hash IP address for privacy - keep only first two octets
 */
function hashIPAddress(ip: string): string {
  if (!ip) return '';
  const parts = ip.split('.');
  if (parts.length !== 4) return 'invalid';
  // Return: 123.45.*.* 
  return `${parts[0]}.${parts[1]}.*.* `;
}

/**
 * Truncate user agent for privacy
 */
function truncateUserAgent(agent: string): string {
  if (!agent) return '';
  // Keep only essential info: browser name and major version
  const match = agent.match(/([A-Z][a-z]+)\s([0-9]+)/);
  return match ? `${match[1]} ${match[2]}` : 'unknown';
}

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  orgId?: string | null;
  severity?: Severity;
  detail?: Record<string, unknown>;
  correlationId?: string; // Link related operations
  resourceId?: string;    // For bulk operations
}

async function requestOrigin(): Promise<{ ip: string; agent: string }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const realIp = h.get('x-real-ip') || '';
    const ip = forwarded || realIp;
    
    return {
      ip: hashIPAddress(ip),
      agent: truncateUserAgent(h.get('user-agent') ?? ''),
    };
  } catch {
    return { ip: '', agent: '' };
  }
}

export async function recordEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { ip, agent } = await requestOrigin();
    
    // Generate correlation ID if not provided (for tracking related ops)
    const correlationId = event.correlationId || crypto.randomUUID();

    await supabase.from('audit_log').insert({
      actor_id: user.id,
      actor_email: user.email ?? '',
      org_id: event.orgId ?? null,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      severity: event.severity ?? 'info',
      detail: event.detail ?? {},
      ip_address: ip,           // Now hashed
      user_agent: agent,        // Now truncated
      correlation_id: correlationId,
      resource_id: event.resourceId,
    });
  } catch {
    // Silently fail - audit should never break user operations
  }
}

// Track bulk operations
export async function recordBulkOperation(
  action: string,
  entityType: string,
  count: number,
  details?: Record<string, unknown>
) {
  const correlationId = crypto.randomUUID();
  
  await recordEvent({
    action,
    entityType,
    severity: count > 10 ? 'notice' : 'info',
    detail: { ...details, count, correlationId },
    correlationId,
  });
}
```

---

## 9. Dependency Scanning Configuration

### GitHub Actions Workflow
```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --frozen-lockfile
      
      - name: Run npm audit
        run: npm audit --production --audit-level=moderate
      
      - name: Run trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          exit-code: '1'
          severity: 'HIGH,CRITICAL'

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Install git-secrets
        run: |
          git clone https://github.com/awslabs/git-secrets.git
          cd git-secrets && make install
      
      - name: Scan for secrets
        run: |
          git secrets --install
          git secrets --register-aws
          git secrets --scan
```

---

## 10. HTTPS & Security Headers Configuration

### Complete Vercel Configuration
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "name": "Proven",
  "framework": "nextjs",
  "installCommand": "npm install --prefix ..",
  "buildCommand": "npm run build --prefix ..",
  "outputDirectory": ".next",
  "trailingSlash": false,
  
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key"
  },

  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", 
          "value": "max-age=31536000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "Permissions-Policy", 
          "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'none'; script-src 'self' https://vercel-analytics.com; style-src 'self'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel-analytics.com; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; upgrade-insecure-requests; block-all-mixed-content"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, must-revalidate, private" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ],

  "redirects": [
    { "source": "/index.html", "destination": "/", "permanent": false },
    { "source": "/http://(.*)", "destination": "https://$1", "permanent": true }
  ]
}
```

---

## Summary of Key Changes

| Issue | Fix | Impact |
|-------|-----|--------|
| Exposed Keys | Rotate + gitignore + Vercel secrets | Prevents key compromise |
| Debug Endpoints | Remove or protect | Removes info disclosure |
| CSP unsafe-inline | Implement nonce-based CSP | Prevents XSS |
| No Rate Limiting | Add Upstash rate limiting | Prevents brute force |
| Weak Input Validation | Add Zod schemas | Prevents injection attacks |
| File Upload Risks | Magic byte verification | Prevents malicious files |
| Session Timeout | Implement 30-min timeout | Prevents session hijacking |
| Audit Privacy | Hash IPs, truncate UA | Complies with privacy regs |
| Missing Headers | Add HSTS, CSP headers | Prevents various attacks |
| No Dependency Scanning | GitHub Actions + npm audit | Catches vulnerable deps |

---

**Priority:** Implement in order of issue severity. Start with critical issues before deployment.
