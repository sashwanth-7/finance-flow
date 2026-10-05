/**
 * Utility functions for PII (Personally Identifiable Information) masking
 * Ensures compliance with Data Privacy Regulations (GDPR, Aadhaar Act, IT Act)
 */

/**
 * Masks an Aadhaar Number (e.g. 1234 5678 9012 -> XXXX-XXXX-9012)
 */
export const maskAadhaar = (val) => {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length < 4) return val;
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
};

/**
 * Masks a PAN Number (e.g. ABCDE1234F -> XXXXX1234F or XXXX1234X)
 */
export const maskPAN = (val) => {
  if (!val) return '';
  const clean = val.trim();
  if (clean.length < 5) return val;
  const last4 = clean.slice(-4);
  return `XXXXX${last4}`;
};

/**
 * Generic Government ID masking based on type
 */
export const maskGovernmentId = (idNumber, idType) => {
  if (!idNumber) return 'Not Provided';
  const type = (idType || '').toUpperCase();

  if (type === 'AADHAR' || type === 'AADHAAR') {
    return maskAadhaar(idNumber);
  }
  if (type === 'PAN') {
    return maskPAN(idNumber);
  }
  
  // Fallback for VOTER / DRIVING / OTHER
  if (idNumber.length > 4) {
    const visible = idNumber.slice(-4);
    return `${'*'.repeat(Math.max(4, idNumber.length - 4))}${visible}`;
  }
  return idNumber;
};

/**
 * Masks a phone number (e.g. +91 9876543210 -> +91 ******3210 or 987****210)
 */
export const maskPhoneNumber = (phone) => {
  if (!phone) return 'N/A';
  const str = String(phone).trim();
  if (str.length <= 4) return str;
  const last4 = str.slice(-4);
  const prefix = str.length > 10 ? str.slice(0, 3) + ' ' : '';
  return `${prefix}*****${last4}`;
};

/**
 * Masks email address (e.g. john.doe@example.com -> j***e@example.com)
 */
export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
};
