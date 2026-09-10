const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const EMAIL_AT = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Validates an email address structurally (local part, @, dot-separated domain). */
export function isValidEmail(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length > 254) return false;
  const [local, ...rest] = trimmed.split('@');
  if (rest.length !== 1 || local.length > 64 || !EMAIL_LOCAL.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!EMAIL_AT.test(trimmed)) return false;
  const [, ...labels] = trimmed.split('.');
  if (labels.length === 0) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2) return false;
  return labels.every((label) => !label.startsWith('-') && !label.endsWith('-'));
}

export const EMAIL_PATTERN = EMAIL_AT.source;
