# Proven Platform - Security Testing & Validation Guide

This document provides concrete testing procedures to validate security improvements and identify remaining issues.

---

## Pre-Deployment Security Checklist

### Authentication & Authorization
- [ ] Password requirements enforced (12+ chars, uppercase, lowercase, numbers, symbols)
- [ ] Session tokens expire after 30 minutes of activity
- [ ] Failed login attempts logged and rate-limited (5 attempts/15 min)
- [ ] Session refresh works correctly in proxy middleware
- [ ] Users cannot manually set their own `is_platform_admin` flag
- [ ] Org admins cannot create orgs for themselves
- [ ] Business owners cannot write to other businesses
- [ ] Funders can only read confirmed business links

### Data Protection
- [ ] Database RLS policies enabled on all tables
- [ ] Row-level security policies tested for each table
- [ ] Service role key only used for administrative operations
- [ ] All file uploads stored in private bucket (not public)
- [ ] Signed URLs expire after 5 minutes
- [ ] Document paths cannot be traversed (`../../../etc/passwd`)
- [ ] Audit logs record all sensitive operations
- [ ] Audit logs are tamper-evident (via database permissions)

### Environment & Configuration
- [ ] All `.env.local` files in `.gitignore`
- [ ] No sensitive keys in git history
- [ ] Secrets stored in Vercel environment (not repo)
- [ ] `.env.example` contains only template values
- [ ] Production environment uses secure backend keys
- [ ] Development uses test/demo keys only

### Security Headers
- [ ] `Strict-Transport-Security` header present
- [ ] `X-Content-Type-Options: nosniff` enforced
- [ ] `X-Frame-Options: DENY` prevents clickjacking
- [ ] `Content-Security-Policy` without unsafe-inline
- [ ] `Referrer-Policy: no-referrer` protects user privacy
- [ ] CORS headers properly configured
- [ ] No wildcard origins allowed

### Input Validation & Output Encoding
- [ ] Email addresses validated against disposable providers
- [ ] Passwords validated for complexity
- [ ] Organization slugs validated for URL safety
- [ ] Business names sanitized (length, characters)
- [ ] File uploads verified for content (magic bytes)
- [ ] File extensions validated against MIME type
- [ ] JSON responses properly typed
- [ ] No SQL injection possible (using parameterized queries)
- [ ] No XSS possible in user-generated content

### Audit & Logging
- [ ] All authentication events logged
- [ ] All permission changes logged
- [ ] All data exports logged
- [ ] Document review decisions logged with reason
- [ ] Failed operations logged with error details
- [ ] IP addresses hashed/truncated in logs
- [ ] Audit logs retention policy defined
- [ ] Log entries immutable (database-enforced)

### Dependency Management
- [ ] npm audit runs in CI/CD
- [ ] No high/critical vulnerabilities in dependencies
- [ ] Lock file (`package-lock.json`) committed
- [ ] Dependency updates reviewed before deployment
- [ ] Transitive dependencies scanned for vulnerabilities

### API & Endpoints
- [ ] All API endpoints require authentication (except public routes)
- [ ] Rate limiting enforced on all endpoints
- [ ] Request/response validation with schemas
- [ ] Error messages don't leak sensitive info
- [ ] Timeouts configured (no infinite requests)
- [ ] Request IDs logged for tracing

### File Handling
- [ ] File uploads scanned for malware
- [ ] File type verified by magic bytes (not extension)
- [ ] PDF files checked for embedded JavaScript
- [ ] File size limits enforced (max 5 MB)
- [ ] Uploaded files not executable
- [ ] Storage bucket policies prevent unauthorized access
- [ ] Temporary files cleaned up after processing

### Testing & Monitoring
- [ ] Automated security tests in CI/CD
- [ ] Manual penetration testing completed
- [ ] Error monitoring configured (Sentry, etc.)
- [ ] Uptime monitoring configured
- [ ] Security incident response plan documented
- [ ] Team trained on security practices

---

## Security Testing Procedures

### 1. Test Rate Limiting

**Objective:** Verify brute force protection works

```bash
#!/bin/bash
# test-rate-limit.sh

# Test 1: Sign-in rate limiting
echo "Testing sign-in rate limiting..."
for i in {1..7}; do
  curl -X POST http://localhost:3000/sign-in \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test@example.com&password=wrongpassword" \
    -v 2>&1 | grep -E "HTTP/|rate limit|Too many"
  sleep 1
done

# Expected: Requests 6-7 should be rate-limited with 429 status
```

### 2. Test Input Validation

**Objective:** Verify injection attacks are prevented

```typescript
// __tests__/security/input-validation.test.ts
import { signInSchema, slugSchema } from '@/lib/validation';
import { ZodError } from 'zod';

describe('Input Validation', () => {
  describe('Email validation', () => {
    it('rejects invalid emails', () => {
      expect(() => signInSchema.parse({ 
        email: 'not-an-email',
        password: 'ValidPass123!',
        next: '/dashboard'
      })).toThrow(ZodError);
    });

    it('rejects disposable email providers', () => {
      expect(() => signInSchema.parse({
        email: 'user@10minutemail.com',
        password: 'ValidPass123!',
        next: '/dashboard'
      })).toThrow(ZodError);
    });

    it('normalizes email to lowercase', () => {
      const result = signInSchema.parse({
        email: 'User@Example.Com',
        password: 'ValidPass123!',
        next: '/dashboard'
      });
      expect(result.email).toBe('user@example.com');
    });
  });

  describe('Slug validation', () => {
    it('rejects special characters', () => {
      expect(() => slugSchema.parse('invalid-slug!@#')).toThrow(ZodError);
    });

    it('rejects uppercase letters', () => {
      expect(() => slugSchema.parse('InvalidSlug')).toThrow(ZodError);
    });

    it('rejects path traversal attempts', () => {
      expect(() => slugSchema.parse('../../../etc/passwd')).toThrow(ZodError);
    });

    it('accepts valid slugs', () => {
      expect(slugSchema.parse('valid-slug-123')).toBe('valid-slug-123');
    });
  });
});
```

### 3. Test Row-Level Security

**Objective:** Verify database access controls work

```sql
-- test-rls.sql
-- Run these tests as different Postgres roles

-- Setup: Create test users and businesses
INSERT INTO auth.users (id, email) VALUES 
  ('user1', 'user1@example.com'),
  ('user2', 'user2@example.com');

INSERT INTO profiles (id, email) VALUES
  ('user1', 'user1@example.com'),
  ('user2', 'user2@example.com');

INSERT INTO businesses (id, owner_id, name) VALUES
  ('biz1', 'user1', 'Business 1'),
  ('biz2', 'user2', 'Business 2');

-- Test 1: User1 cannot see User2's business
SET SESSION AUTHORIZATION 'user1';
SELECT * FROM businesses WHERE id = 'biz2';
-- Expected: Empty result (RLS prevents access)

-- Test 2: User1 can see their own business
SELECT * FROM businesses WHERE id = 'biz1';
-- Expected: Returns row

-- Test 3: User cannot insert business for someone else
INSERT INTO businesses (owner_id, name) VALUES ('user2', 'Fake Business');
-- Expected: Fails (RLS policy prevents)

-- Test 4: Service role can see all businesses
SET ROLE service_role;
SELECT * FROM businesses;
-- Expected: Returns all rows (service role bypasses RLS)
```

### 4. Test Authentication Flow

**Objective:** Verify secure session handling

```typescript
// __tests__/security/auth-flow.test.ts
import { createClient } from '@/lib/supabase/server';
import { signIn } from '@/app/(auth)/actions';

describe('Authentication Flow', () => {
  it('creates secure session cookies', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'ValidPass123!');
    
    // This should set secure session cookies
    const result = await signIn({}, formData);
    
    // Verify no sensitive data in response
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('password');
  });

  it('rejects expired sessions', async () => {
    // Mock an expired session
    const supabase = await createClient();
    const { data: session } = await supabase.auth.getSession();
    
    // Manually expire the session
    await supabase.auth.signOut();
    
    // Try to access protected resource
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .single();
    
    // Should fail or be redirected to login
    expect(profile).toBeNull();
  });

  it('logs failed login attempts', async () => {
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('password', 'WrongPassword123!');
    
    await signIn({}, formData);
    
    // Check audit log
    const supabase = await createClient();
    const { data: logs } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'auth.sign_in_failed')
      .order('created_at', { ascending: false })
      .limit(1);
    
    expect(logs).toHaveLength(1);
    expect(logs[0].actor_email).toBe('user@example.com');
  });
});
```

### 5. Test File Upload Security

**Objective:** Verify file validation and storage security

```typescript
// __tests__/security/file-upload.test.ts
import { attachDocument } from '@/app/businesses/documents';

describe('File Upload Security', () => {
  it('rejects files with incorrect magic bytes', async () => {
    // Create a file claiming to be PDF but with image data
    const fakeFile = new File(
      [Buffer.from([0x89, 0x50, 0x4e, 0x47])], // PNG header
      'malicious.pdf',
      { type: 'application/pdf' }
    );

    const formData = new FormData();
    formData.append('file', fakeFile);
    formData.append('transaction_id', 'tx123');
    formData.append('business_id', 'biz123');

    const result = await attachDocument({}, formData);
    expect(result.error).toContain('does not match');
  });

  it('rejects PDFs with embedded JavaScript', async () => {
    const maliciousPDF = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
      Buffer.from('/JavaScript malicious code'),
    ]);

    const file = new File([maliciousPDF], 'malicious.pdf', 
      { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('transaction_id', 'tx123');
    formData.append('business_id', 'biz123');

    const result = await attachDocument({}, formData);
    expect(result.error).toContain('JavaScript');
  });

  it('enforces file size limits', async () => {
    // Create 6 MB file (exceeds 5 MB limit)
    const largeFile = new File(
      [new ArrayBuffer(6 * 1024 * 1024)],
      'large.pdf',
      { type: 'application/pdf' }
    );

    const formData = new FormData();
    formData.append('file', largeFile);
    formData.append('transaction_id', 'tx123');
    formData.append('business_id', 'biz123');

    const result = await attachDocument({}, formData);
    expect(result.error).toContain('too large');
  });

  it('prevents path traversal in filenames', async () => {
    const file = new File(['data'], '../../../etc/passwd', 
      { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('transaction_id', 'tx123');
    formData.append('business_id', 'biz123');

    const result = await attachDocument({}, formData);
    
    // If successful, verify the stored path is safe
    // (implementation should strip directory traversal)
  });
});
```

### 6. Test CORS & CSP

**Objective:** Verify cross-origin protection

```typescript
// __tests__/security/cors-csp.test.ts
describe('CORS & CSP Headers', () => {
  it('blocks requests from invalid origins', async () => {
    const response = await fetch('http://localhost:3000/api/data', {
      headers: {
        'Origin': 'https://evil.com'
      }
    });

    // Should block or return limited data
    expect(response.status).toBe(403);
  });

  it('includes CSP header without unsafe-inline', async () => {
    const response = await fetch('http://localhost:3000/');
    const csp = response.headers.get('content-security-policy');
    
    expect(csp).toBeDefined();
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('includes HSTS header', async () => {
    const response = await fetch('https://proven.app/');
    const hsts = response.headers.get('strict-transport-security');
    
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');
  });
});
```

### 7. Test Error Handling

**Objective:** Verify no sensitive data leakage in errors

```typescript
// __tests__/security/error-handling.test.ts
describe('Error Handling', () => {
  it('does not expose database errors to users', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'ValidPass123!');

    // Cause a database constraint error
    const result = await signIn({}, formData);

    // Error should not contain database error codes
    expect(result.error).not.toMatch(/23505|23503|42P01/);
  });

  it('does not expose stack traces', async () => {
    // Make a request that causes an error
    const response = await fetch('http://localhost:3000/api/invalid');
    const body = await response.text();

    // Should not contain file paths or line numbers
    expect(body).not.toMatch(/\/Users\/|at [A-Za-z]+:/);
  });

  it('logs detailed errors server-side only', async () => {
    // Make request that fails
    const response = await fetch('http://localhost:3000/sign-in', {
      method: 'POST',
      body: 'invalid-data'
    });

    // Client should get generic message
    const error = await response.text();
    expect(error).toContain('error');
    expect(error).not.toContain('stack');
  });
});
```

### 8. Manual Security Testing Checklist

```bash
# Test SQL Injection
curl -X POST http://localhost:3000/sign-in \
  -d "email=admin' OR '1'='1&password=anything"

# Test XSS in business name
curl -X POST http://localhost:3000/business/create \
  -d "name=<script>alert('xss')</script>&industry=tech"

# Test CSRF (missing CSRF token)
curl -X POST http://localhost:3000/business/delete \
  -H "Origin: https://attacker.com" \
  -d "id=business123"

# Test Open Redirect
curl -X GET "http://localhost:3000/sign-in?next=http://attacker.com"

# Test sensitive header disclosure
curl -I http://localhost:3000/ | grep -E "Server|X-Powered|X-AspNet"

# Test weak SSL/TLS
nmap --script ssl-enum-ciphers -p 443 proven.app

# Test for exposed git files
curl https://proven.app/.git/config

# Test for directory listing
curl https://proven.app/app/src/
```

---

## Automated Security Testing

### GitHub Actions Test Workflow

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --frozen-lockfile
      
      - name: Run security tests
        run: npm run test:security
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost/test
      
      - name: Run E2E security tests
        run: npm run test:e2e:security
      
      - name: OWASP ZAP scan
        uses: zaproxy/action-baseline@v0.4.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
```

### Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:security": "vitest --include='**/*.security.test.ts'",
    "test:integration": "vitest --include='**/*.integration.test.ts'",
    "test:cov": "vitest --coverage",
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix --production"
  }
}
```

---

## Continuous Security Monitoring

### Recommended Tools

| Tool | Purpose | Integration |
|------|---------|-------------|
| **npm audit** | Dependency vulnerabilities | CI/CD pipeline |
| **Snyk** | Advanced vulnerability scanning | GitHub/Vercel |
| **Sentry** | Error & security monitoring | Application |
| **Datadog** | Security analytics | Infrastructure |
| **GitHub Secret Scanning** | Exposed credentials | GitHub |
| **Trivy** | Container/fs vulnerability scan | CI/CD |
| **SonarQube** | Code quality & security | CI/CD |
| **OWASP ZAP** | Dynamic security testing | CI/CD |

### Sentry Integration Example

```typescript
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Db(),
    new Sentry.Integrations.Http({ request: true, response: false }),
  ],
  beforeSend(event) {
    // Strip sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers['authorization'];
    }
    return event;
  },
});
```

---

## Incident Response Checklist

When a security incident is suspected:

- [ ] **Immediate:** Isolate affected systems
- [ ] **Within 1 hour:** Alert security team and affected users
- [ ] **Within 6 hours:** Begin root cause analysis
- [ ] **Within 24 hours:** Determine scope and impact
- [ ] **Within 48 hours:** Implement fixes and deploy
- [ ] **Within 1 week:** Complete post-incident review
- [ ] **Ongoing:** Update security measures based on findings

---

## Security Testing Metrics

Track these metrics over time:

- **Vulnerability detection rate:** # of vulnerabilities found in testing
- **Time to fix:** Average time to remediate found vulnerabilities
- **False positive rate:** % of security findings that aren't real issues
- **Coverage:** % of code/endpoints with security tests
- **Audit log retention:** # of days/months of audit logs retained
- **Patch time:** Days to apply security updates after release
- **Incident response time:** Hours from detection to mitigation

---

**Note:** These tests should be run in a staging environment before any production deployment.
