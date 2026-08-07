/**
 * Robust WhatsApp E.164 phone number formatter.
 * Handles Indian numbers (+91), US numbers (+1), and International formats gracefully.
 */
export function formatWhatsAppNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const str = String(rawPhone).trim();
  if (str.startsWith('whatsapp:')) return str;

  const clean = str.replace(/\D/g, '');
  if (!clean) return '';

  // If originally started with +, trust the full clean number
  if (str.startsWith('+')) {
    return `whatsapp:+${clean}`;
  }

  // US 11-digit number (e.g. 17372508034)
  if (clean.length === 11 && clean.startsWith('1')) {
    return `whatsapp:+${clean}`;
  }

  // India 12-digit number (e.g. 919876543210)
  if (clean.length === 12 && clean.startsWith('91')) {
    return `whatsapp:+${clean}`;
  }

  // 10-digit standard mobile number
  if (clean.length === 10) {
    // If starting with 6, 7, 8, 9 -> Indian mobile
    if (['6', '7', '8', '9'].includes(clean[0])) {
      return `whatsapp:+91${clean}`;
    }
    // US 10-digit number without country code
    return `whatsapp:+1${clean}`;
  }

  return `whatsapp:+${clean}`;
}

/**
 * Translates raw Twilio API error responses into clear, actionable messages.
 */
export function friendlyTwilioError(rawError: string): string {
  if (!rawError) return 'Unknown error';
  if (rawError.includes('ContentSid Required')) {
    return 'Twilio Policy: ContentSid (Template) required for broadcasts outside 24h customer conversation window.';
  }
  if (rawError.includes('verified recipient') || rawError.includes('trial phone number')) {
    return 'Twilio Trial restriction: Recipient must join WhatsApp Sandbox (+1 737 250-8034) first.';
  }
  return rawError;
}
