/**
 * Where this deployment lives, for links sent out by email.
 *
 * Its own module with no directive, because a `'use server'` file may only
 * export async functions — so this cannot be shared from the auth actions
 * where it started, and both places need it: password resets and staff
 * invitations both send a link back to the app.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when it is set, which is what a production
 * deployment should do: forwarded headers are attacker-controllable, and a
 * link in an email is precisely where that would matter.
 */
export function siteOrigin(requestHeaders: Headers): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost ?? requestHeaders.get('host');
  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  const protocol = forwardedProto?.split(',')[0]?.trim() || 'http';
  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}
