// app/src/lib/validation.ts
import { z } from 'zod';

// Email with disposable provider blocklist
const DISPOSABLE_EMAILS = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'temp-mail.org',
  'yopmail.com',
];

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email is too long')
  .toLowerCase()
  .refine(
    (email) => {
      const domain = email.split('@')[1]?.toLowerCase();
      return typeof domain === 'string' && !DISPOSABLE_EMAILS.includes(domain);
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
  .refine(
    (slug) => !slug.startsWith('-') && !slug.endsWith('-'),
    'Slug cannot start or end with a hyphen'
  );

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
    const allowed = ['/dashboard', '/business', '/funder', '/admin', '/account'];
    return allowed.some((p) => url.startsWith(p));
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

export const orgSlugSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  slug: slugSchema,
});
