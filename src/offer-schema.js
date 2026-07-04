// ============================================================
//  offer-schema.js — offer slide (type B) data schema
//  Defines editable fields + simple deterministic validation.
// ============================================================

// Editable fields in the template (filled by user / extracted from PDF later)
const FIELDS = {
  origin:        { label: 'Origin city',     type: 'text', required: true, maxLen: 18 },
  destination:   { label: 'Destination',     type: 'text', required: true, maxLen: 20 },
  price:         { label: 'Price (digits)',  type: 'text', required: true, maxLen: 6  },
  date_out:      { label: 'Departure date',  type: 'text', required: true, maxLen: 12 },
  date_return:   { label: 'Return date',     type: 'text', required: true, maxLen: 12 },
  baggage_1:     { label: 'Baggage 1',       type: 'text', required: false, maxLen: 8  },
  baggage_2:     { label: 'Baggage 2',       type: 'text', required: false, maxLen: 8  },
  image_subject: { label: 'Image subject',   type: 'text', required: true, maxLen: 60 },
};

// Default values for testing
const DEFAULTS = {
  origin: 'STUTTGART',
  destination: 'Barcelona',
  price: '139',
  date_out: '09.07.2026',
  date_return: '15.07.2026',
  baggage_1: '15 KG',
  baggage_2: '8 KG',
  image_subject: 'Barcelona Spain city panorama Sagrada Familia',
};

// Simple deterministic validation -> returns array of errors (empty = valid)
function validate(data) {
  const errors = [];
  for (const [key, rule] of Object.entries(FIELDS)) {
    const val = (data[key] ?? '').toString().trim();
    if (rule.required && !val) {
      errors.push(`Field "${rule.label}" is required`);
      continue;
    }
    if (val.length > rule.maxLen) {
      errors.push(`Field "${rule.label}" exceeds max length (${rule.maxLen})`);
    }
  }
  return errors;
}

// Clean + normalize -> origin always uppercase, price digits only
function normalize(data) {
  const out = { ...DEFAULTS, ...data };
  out.origin = (out.origin || '').toUpperCase();
  out.price = (out.price || '').toString().replace(/[^0-9]/g, '');
  return out;
}

module.exports = { FIELDS, DEFAULTS, validate, normalize };
