/**
 * Result contract for the ID-card extraction module.
 *
 * This shape is the agreed boundary between the OCR pipeline and the upload
 * review UI. It must also be compatible with the future `reviewed-profile`
 * module which will receive results from multiple sources (id-card, Linways).
 *
 * Rules preserved from the spec:
 * - `fields` values are verbatim OCR spelling — never normalised by this module.
 * - `additionalFields` holds any clearly labeled pairs not in the known set.
 * - Missing or ambiguous fields are empty strings, not null/undefined.
 * - `rawText` is always present; it lets the student verify OCR accuracy.
 * - `status: 'failed'` is returned for blank/unreadable images; the module
 *   never invents values.
 */

/** Known labeled fields the parser looks for on an ID card. */
export type ExtractedFields = Readonly<{
  name: string;
  studentId: string;
  department: string;
  program: string;
  birthDate: string;
  residentialAddress: string;
  year: string;
  email: string;
  phone: string;
}>;

/** A labeled field that was found but is not in the known set. */
export type AdditionalField = Readonly<{
  label: string;
  value: string;
}>;

/**
 * The result returned by the id-card extraction pipeline.
 *
 * `source` is always `'id-card'` so downstream consumers can distinguish
 * results from multiple extraction sources.
 *
 * `status`:
 *   - `'success'`     — OCR produced text (fields may still be empty).
 *   - `'failed'`      — OCR returned blank/unreadable text, or OCR threw.
 *   - `'unavailable'` — reserved for infrastructure failures (worker refused
 *                       to start, language asset missing, etc.).
 */
export type ExtractionResult = Readonly<{
  source: 'id-card';
  status: 'success' | 'failed' | 'unavailable';
  fields: ExtractedFields;
  additionalFields: readonly AdditionalField[];
  rawText: string;
  error?: Readonly<{ code: string; message: string }>;
}>;

/** Only the approved college-card suggestions leave the extraction API. */
export type IdCardReviewResult = Readonly<{
  source: 'id-card';
  status: ExtractionResult['status'];
  fields: Pick<ExtractedFields, 'birthDate' | 'residentialAddress' | 'phone'>;
  error?: ExtractionResult['error'];
}>;

/** Empty fields value — used as the baseline when constructing results. */
export const EMPTY_FIELDS: ExtractedFields = Object.freeze({
  name: '',
  studentId: '',
  department: '',
  program: '',
  birthDate: '',
  residentialAddress: '',
  year: '',
  email: '',
  phone: '',
});

/** Convenience factory for a successful extraction result. */
export function successResult(
  rawText: string,
  fields: ExtractedFields,
  additionalFields: readonly AdditionalField[],
): ExtractionResult {
  return Object.freeze({
    source: 'id-card',
    status: 'success',
    fields,
    additionalFields,
    rawText,
  });
}

/** Convenience factory for a failed extraction result. */
export function failedResult(
  code: string,
  message: string,
  rawText = '',
): ExtractionResult {
  return Object.freeze({
    source: 'id-card',
    status: 'failed',
    fields: EMPTY_FIELDS,
    additionalFields: [],
    rawText,
    error: Object.freeze({ code, message }),
  });
}

/** Convenience factory for an unavailable extraction result. */
export function unavailableResult(code: string, message: string): ExtractionResult {
  return Object.freeze({
    source: 'id-card',
    status: 'unavailable',
    fields: EMPTY_FIELDS,
    additionalFields: [],
    rawText: '',
    error: Object.freeze({ code, message }),
  });
}
