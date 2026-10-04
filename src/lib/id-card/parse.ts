/**
 * Conservative labeled parser for ID-card OCR text.
 *
 * Rules:
 * - Only extracts explicitly labeled fields (e.g. `Label: Value`).
 * - Never guesses or infers fields from unlabeled text.
 * - Preserves OCR spelling verbatim; never normalises or auto-corrects values.
 * - Preserves leading zeros in student IDs and numeric strings.
 * - Conflicting values for the same field yield an empty string (ambiguous).
 * - Clear unknown `label: value` pairs are placed in `additionalFields`.
 * - Blank or non-alphanumeric text yields a safe failed result.
 */

import {
  type AdditionalField,
  type ExtractedFields,
  type ExtractionResult,
  EMPTY_FIELDS,
  failedResult,
  successResult,
} from './types';

/** Map of normalized label strings to ExtractedFields keys. */
const KNOWN_LABEL_MAP: Record<string, keyof ExtractedFields> = {
  // name
  'name': 'name',
  'student name': 'name',
  'full name': 'name',
  'candidate name': 'name',
  'students name': 'name',
  'name of student': 'name',
  'name of the student': 'name',

  // studentId
  'student id': 'studentId',
  'student id no': 'studentId',
  'student id number': 'studentId',
  'student no': 'studentId',
  'student number': 'studentId',
  'id': 'studentId',
  'id no': 'studentId',
  'id number': 'studentId',
  'roll no': 'studentId',
  'roll number': 'studentId',
  'reg no': 'studentId',
  'reg number': 'studentId',
  'registration no': 'studentId',
  'registration number': 'studentId',
  'register no': 'studentId',
  'register number': 'studentId',
  'admission no': 'studentId',
  'admission number': 'studentId',
  'adm no': 'studentId',
  'adm number': 'studentId',
  'enrolment no': 'studentId',
  'enrolment number': 'studentId',
  'enrollment no': 'studentId',
  'enrollment number': 'studentId',
  'urn': 'studentId',
  'usn': 'studentId',
  'prn': 'studentId',

  // department
  'department': 'department',
  'dept': 'department',
  'dept no': 'department',
  'branch': 'department',
  'stream': 'department',
  'discipline': 'department',

  // program
  'program': 'program',
  'programme': 'program',
  'course': 'program',
  'degree': 'program',
  'course branch': 'program',
  'program branch': 'program',

  // birthDate
  'dob': 'birthDate',
  'd o b': 'birthDate',
  'date of birth': 'birthDate',
  'birth date': 'birthDate',
  'birthdate': 'birthDate',
  'born': 'birthDate',

  // year
  'year': 'year',
  'class': 'year',
  'batch': 'year',
  'academic year': 'year',
  'acad year': 'year',
  'sem': 'year',
  'semester': 'year',
  'study year': 'year',

  // email
  'email': 'email',
  'e mail': 'email',
  'email id': 'email',
  'e mail id': 'email',
  'mail': 'email',
  'mail id': 'email',

  // phone
  'phone': 'phone',
  'phone no': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'mobile no': 'phone',
  'mobile number': 'phone',
  'contact': 'phone',
  'contact no': 'phone',
  'contact number': 'phone',
  'cell': 'phone',
  'cell no': 'phone',
  'cell number': 'phone',
  'tel': 'phone',
  'tel no': 'phone',
  'telephone': 'phone',
  'telephone no': 'phone',
};

/** Normalize a label string for comparison against known labels. */
export function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[._"():-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if a normalized string is a known label key. */
export function getKnownFieldKey(rawLabel: string): keyof ExtractedFields | undefined {
  const normalized = normalizeLabel(rawLabel);
  return KNOWN_LABEL_MAP[normalized];
}

interface ParsedPair {
  label: string;
  value: string;
}

/**
 * Split a single line into candidate segments if multiple labeled fields
 * exist on the same line (separated by pipe, tab, or double-space with separator).
 */
function splitLineSegments(line: string): string[] {
  if (line.includes('|')) {
    return line.split('|').map((s) => s.trim()).filter(Boolean);
  }
  if (line.includes('\t')) {
    return line.split('\t').map((s) => s.trim()).filter(Boolean);
  }
  // Check if line contains multiple "Label: Value" pairs separated by 2+ spaces.
  // Example: "Dept: CS    Year: 2"
  const multiMatch = line.split(/\s{2,}(?=[A-Za-z][A-Za-z0-9 .'/&-]{1,30}\s*[:=-])/);
  if (multiMatch.length > 1) {
    return multiMatch.map((s) => s.trim()).filter(Boolean);
  }
  return [line.trim()];
}

/**
 * Parse a segment into a label and a value if a delimiter is present.
 */
function parseSegment(segment: string): ParsedPair | null {
  // 1. Colon delimiter (most common)
  const colonIndex = segment.indexOf(':');
  if (colonIndex > 0 && colonIndex <= 45) {
    const label = segment.slice(0, colonIndex).trim();
    const value = segment.slice(colonIndex + 1).trim();
    if (label.length > 0) {
      return { label, value };
    }
  }

  // 2. Dash/hyphen delimiter with spaces around it: "Label - Value"
  const dashMatch = segment.match(/^([A-Za-z][A-Za-z0-9 /.'&]{1,40})\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    return { label: dashMatch[1].trim(), value: dashMatch[2].trim() };
  }

  // 3. Equals delimiter: "Label = Value"
  const equalsMatch = segment.match(/^([A-Za-z][A-Za-z0-9 /.'&]{1,40})\s*=\s*(.+)$/);
  if (equalsMatch) {
    return { label: equalsMatch[1].trim(), value: equalsMatch[2].trim() };
  }

  return null;
}

/**
 * Find a specific labeled value from a list of text lines.
 * Useful for targeted lookups as specified in SPEC-id-card-extraction.md.
 */
export function labeledValue(targetLabel: string, lines: readonly string[]): string | undefined {
  const targetKey = getKnownFieldKey(targetLabel) ?? normalizeLabel(targetLabel);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]?.trim() ?? '';
    if (!rawLine) continue;

    const segments = splitLineSegments(rawLine);
    for (const segment of segments) {
      const parsed = parseSegment(segment);
      if (parsed) {
        const key = getKnownFieldKey(parsed.label) ?? normalizeLabel(parsed.label);
        if (key === targetKey && parsed.value) {
          return parsed.value;
        }
      }
    }

    // Two-line check
    const normalizedLine = normalizeLabel(rawLine);
    const isTarget =
      (getKnownFieldKey(rawLine) ?? normalizedLine) === targetKey ||
      rawLine.replace(/[:=-]$/, '').trim().toLowerCase() === targetLabel.toLowerCase();

    if (isTarget && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim() ?? '';
      if (nextLine && !parseSegment(nextLine) && !getKnownFieldKey(nextLine)) {
        return nextLine;
      }
    }
  }

  return undefined;
}

/**
 * Parse all labeled fields from OCR text.
 */
export function parseFields(rawText: string): {
  fields: ExtractedFields;
  additionalFields: readonly AdditionalField[];
} {
  const lines = rawText.split(/\r?\n/);
  const pairs: ParsedPair[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line) continue;

    const segments = splitLineSegments(line);

    for (const segment of segments) {
      const parsed = parseSegment(segment);
      if (parsed) {
        if (parsed.value) {
          pairs.push(parsed);
        } else if (i + 1 < lines.length) {
          // Label with trailing colon but value on next line:
          // Line i: "Name:"
          // Line i + 1: "Alice Smith"
          const nextLine = lines[i + 1]?.trim() ?? '';
          if (nextLine && !parseSegment(nextLine) && !getKnownFieldKey(nextLine)) {
            pairs.push({ label: parsed.label, value: nextLine });
            i++; // Consume next line
          }
        }
        continue;
      }

      // Check if line by itself is a known label without delimiter:
      // Line i: "Student ID"
      // Line i + 1: "0012345"
      const knownKey = getKnownFieldKey(segment);
      if (knownKey && i + 1 < lines.length) {
        const nextLine = lines[i + 1]?.trim() ?? '';
        if (nextLine && !parseSegment(nextLine) && !getKnownFieldKey(nextLine)) {
          pairs.push({ label: segment, value: nextLine });
          i++; // Consume next line
        }
      }
    }
  }

  // Aggregate candidate values per known field
  const knownCandidates = new Map<keyof ExtractedFields, Set<string>>();
  for (const k of Object.keys(EMPTY_FIELDS) as (keyof ExtractedFields)[]) {
    knownCandidates.set(k, new Set<string>());
  }

  // Aggregate candidate values for unknown labels
  const unknownCandidates = new Map<string, { label: string; values: Set<string> }>();

  for (const { label, value } of pairs) {
    if (!value) continue;
    const knownKey = getKnownFieldKey(label);

    if (knownKey) {
      knownCandidates.get(knownKey)!.add(value);
    } else {
      const norm = normalizeLabel(label);
      // Clean label for presentation (strip trailing punctuation)
      const cleanLabel = label.replace(/[:=-]+$/, '').trim();
      const existing = unknownCandidates.get(norm);
      if (existing) {
        existing.values.add(value);
      } else {
        unknownCandidates.set(norm, {
          label: cleanLabel,
          values: new Set([value]),
        });
      }
    }
  }

  // Build resolved ExtractedFields
  // If multiple conflicting values exist for a field, leave it empty as ambiguous
  const resolvedFields: Record<string, string> = {};
  for (const [key, values] of knownCandidates.entries()) {
    if (values.size === 1) {
      resolvedFields[key] = Array.from(values)[0]!;
    } else {
      // 0 or >1 (conflicting) -> empty string
      resolvedFields[key] = '';
    }
  }

  // Build resolved AdditionalFields
  // Only include if value is non-empty and non-conflicting
  const resolvedAdditional: AdditionalField[] = [];
  for (const [, { label, values }] of unknownCandidates.entries()) {
    if (values.size === 1) {
      const val = Array.from(values)[0]!;
      if (val) {
        resolvedAdditional.push(Object.freeze({ label, value: val }));
      }
    }
  }

  return {
    fields: Object.freeze(resolvedFields as unknown as ExtractedFields),
    additionalFields: Object.freeze(resolvedAdditional),
  };
}

/**
 * Main entry point: parse raw OCR text into an ExtractionResult.
 */
export function parseIdCardText(rawText: string): ExtractionResult {
  if (!rawText || !rawText.trim()) {
    return failedResult(
      'empty_ocr',
      'No text could be extracted from the image. Please try a clearer image.',
      rawText,
    );
  }

  // Check if text is only non-alphanumeric noise (e.g. dots, dashes, colons)
  if (!/[a-zA-Z0-9]/.test(rawText)) {
    return failedResult(
      'unreadable_ocr',
      'The image could not be read clearly. Please upload a sharper image.',
      rawText,
    );
  }

  const { fields, additionalFields } = parseFields(rawText);
  return successResult(rawText, fields, additionalFields);
}
