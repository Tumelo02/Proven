export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return 'Use at least 12 characters.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Include at least one lowercase letter.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Include at least one uppercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Include at least one number.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Include at least one symbol such as !, @, #, $, %, ^, &, or *.';
  }

  return null;
}
