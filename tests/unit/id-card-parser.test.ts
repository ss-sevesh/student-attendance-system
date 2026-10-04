import { describe, expect, it } from 'vitest';
import {
  getKnownFieldKey,
  labeledValue,
  normalizeLabel,
  parseFields,
  parseIdCardText,
} from '../../src/lib/id-card/parse';
import { EMPTY_FIELDS } from '../../src/lib/id-card/types';

describe('ID-card parser (Task 2)', () => {
  it('parses standard labeled ID card text with all known fields', () => {
    const raw = `
CENTRAL INSTITUTE OF TECHNOLOGY
Name: Jane Example
Student ID: 001234567
Department: Computer Science
Program: B.Tech
DOB: 15/05/2002
Year: 2
Email: jane@example.edu
Phone: +1 555-0199
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.source).toBe('id-card');
    expect(result.status).toBe('success');
    expect(result.rawText).toBe(raw);
    expect(result.error).toBeUndefined();

    expect(result.fields.name).toBe('Jane Example');
    expect(result.fields.studentId).toBe('001234567');
    expect(result.fields.department).toBe('Computer Science');
    expect(result.fields.program).toBe('B.Tech');
    expect(result.fields.birthDate).toBe('15/05/2002');
    expect(result.fields.year).toBe('2');
    expect(result.fields.email).toBe('jane@example.edu');
    expect(result.fields.phone).toBe('+1 555-0199');
    expect(result.additionalFields).toEqual([]);
  });

  it('preserves leading zeros in studentId verbatim', () => {
    const raw = 'Roll No: 000042\nName: Alice';
    const result = parseIdCardText(raw);

    expect(result.fields.studentId).toBe('000042');
    expect(typeof result.fields.studentId).toBe('string');
  });

  it('preserves OCR spelling verbatim without correcting typos', () => {
    const raw = 'Name: J@ne Ex4mple\nDept: Comp Scienec';
    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('J@ne Ex4mple');
    expect(result.fields.department).toBe('Comp Scienec');
  });

  it('extracts unknown labeled fields into additionalFields', () => {
    const raw = `
Name: Bob Smith
Student ID: 009876
Blood Group: O+
Valid Till: 2026-12-31
Emergency Contact: 9988776655
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Bob Smith');
    expect(result.fields.studentId).toBe('009876');
    expect(result.additionalFields).toEqual([
      { label: 'Blood Group', value: 'O+' },
      { label: 'Valid Till', value: '2026-12-31' },
      { label: 'Emergency Contact', value: '9988776655' },
    ]);
  });

  it('does NOT guess from unlabeled text', () => {
    const raw = `
NATIONAL UNIVERSITY
STUDENT IDENTITY CARD
Alice Wonder
007654321
Mathematics Department
Bachelor of Science
2024
alice@nu.edu
+91 9876543210
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.status).toBe('success');
    expect(result.rawText).toBe(raw);
    expect(result.fields).toEqual(EMPTY_FIELDS);
    expect(result.additionalFields).toEqual([]);
  });

  it('leaves missing fields as empty strings', () => {
    const raw = 'Name: Charlie Brown';
    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Charlie Brown');
    expect(result.fields.studentId).toBe('');
    expect(result.fields.department).toBe('');
    expect(result.fields.program).toBe('');
    expect(result.fields.birthDate).toBe('');
    expect(result.fields.residentialAddress).toBe('');
    expect(result.fields.year).toBe('');
    expect(result.fields.email).toBe('');
    expect(result.fields.phone).toBe('');
  });

  it('leaves conflicting field values empty (ambiguity handling)', () => {
    const raw = `
Name: Alice Smith
Name: Bob Jones
Student ID: 00123
ID No: 00456
Department: Physics
    `.trim();

    const result = parseIdCardText(raw);

    // Name and StudentId have conflicting values -> must be empty
    expect(result.fields.name).toBe('');
    expect(result.fields.studentId).toBe('');
    // Non-conflicting field should still resolve
    expect(result.fields.department).toBe('Physics');
  });

  it('resolves duplicate identical values without considering them ambiguous', () => {
    const raw = `
Name: Alice Smith
Name: Alice Smith
Student ID: 00123
Roll No: 00123
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Alice Smith');
    expect(result.fields.studentId).toBe('00123');
  });

  it('handles label aliases and case variations', () => {
    const raw = `
FULL NAME: Diana Prince
REG NO: 2026TECH01
BRANCH: Electrical Engineering
COURSE: M.Tech
DATE OF BIRTH: 1999-11-20
BATCH: 2024-2026
E-MAIL: diana@tech.ac.in
MOBILE NO: +44 7700 900077
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Diana Prince');
    expect(result.fields.studentId).toBe('2026TECH01');
    expect(result.fields.department).toBe('Electrical Engineering');
    expect(result.fields.program).toBe('M.Tech');
    expect(result.fields.birthDate).toBe('1999-11-20');
    expect(result.fields.year).toBe('2024-2026');
    expect(result.fields.email).toBe('diana@tech.ac.in');
    expect(result.fields.phone).toBe('+44 7700 900077');
  });

  it('handles various delimiter formats (colon, dash, equals, spacing)', () => {
    const raw = `
Name : Eve Davis
Student ID - 008899
Dept:Bioinformatics
Program = B.Sc
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Eve Davis');
    expect(result.fields.studentId).toBe('008899');
    expect(result.fields.department).toBe('Bioinformatics');
    expect(result.fields.program).toBe('B.Sc');
  });

  it('parses two-line labels where value is on the following line', () => {
    const raw = `
Name:
Frank Castle
Student ID
007007
Branch:
Cyber Security
    `.trim();

    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Frank Castle');
    expect(result.fields.studentId).toBe('007007');
    expect(result.fields.department).toBe('Cyber Security');
  });

  it('parses multiple labeled pairs on the same line', () => {
    const raw = 'Dept: Computer Science | Year: 3\nName: Grace Hopper    Roll No: 0001';
    const result = parseIdCardText(raw);

    expect(result.fields.name).toBe('Grace Hopper');
    expect(result.fields.studentId).toBe('0001');
    expect(result.fields.department).toBe('Computer Science');
    expect(result.fields.year).toBe('3');
  });

  it('returns failed result for blank or whitespace-only OCR text', () => {
    const emptyResult = parseIdCardText('');
    expect(emptyResult.status).toBe('failed');
    expect(emptyResult.error?.code).toBe('empty_ocr');
    expect(emptyResult.fields).toEqual(EMPTY_FIELDS);

    const wsResult = parseIdCardText('   \n\t  \r\n  ');
    expect(wsResult.status).toBe('failed');
    expect(wsResult.error?.code).toBe('empty_ocr');
  });

  it('returns failed result for unreadable non-alphanumeric noise', () => {
    const noiseResult = parseIdCardText('::: --- ... /// ===');
    expect(noiseResult.status).toBe('failed');
    expect(noiseResult.error?.code).toBe('unreadable_ocr');
  });

  it('labeledValue helper returns targeted values from line arrays', () => {
    const lines = [
      'STATE UNIVERSITY',
      'Name: Helen Keller',
      'Student ID: 004455',
      'Blood Group: A+',
    ];

    expect(labeledValue('Name', lines)).toBe('Helen Keller');
    expect(labeledValue('Student ID', lines)).toBe('004455');
    expect(labeledValue('Blood Group', lines)).toBe('A+');
    expect(labeledValue('Department', lines)).toBeUndefined();
  });

  it('normalizes labels and maps to known keys', () => {
    expect(normalizeLabel('  D.O.B.:  ')).toBe('d o b');
    expect(normalizeLabel("Student's Name")).toBe('students name');
    expect(getKnownFieldKey('Roll No.')).toBe('studentId');
    expect(getKnownFieldKey('Date of Birth')).toBe('birthDate');
    expect(getKnownFieldKey('Blood Group')).toBeUndefined();
  });

  it('parseFields returns isolated fields and additionalFields objects', () => {
    const { fields, additionalFields } = parseFields('Name: Isaac\nCampus: North');
    expect(fields.name).toBe('Isaac');
    expect(additionalFields).toEqual([{ label: 'Campus', value: 'North' }]);
  });

  it('extracts only clean college-card DOB, address, and phone from noisy repeated OCR', () => {
    const raw = `\\¥ [KE NGU
i | Paseo Ue Best i
A 3 Date of Birth : 11.05.2006 ;
ho § | Blood Group : A1+ve
bh &) \\ | Resi. Address :
WA S/O SAMPLE PARENT
| 3/498,2E, KAMARAJ NAGAR
| BALASAMUTHRAM
1 PERUMANALLUR-641666
| Phone : 9876543210 |

Date of Birth : 11.05.2006
Blood Group : A1+ve
Resi. Address :
S/O SAMPLE PARENT
3/498,2E, KAMARAJ NAGAR
BALASAMUTHRAM
PERUMANALLUR-641666
Phone : 9876543210`;
    const result = parseIdCardText(raw);
    expect(result.fields.birthDate).toBe('11.05.2006');
    expect(result.fields.residentialAddress).toBe('S/O SAMPLE PARENT\n3/498,2E, KAMARAJ NAGAR\nBALASAMUTHRAM\nPERUMANALLUR-641666');
    expect(result.fields.phone).toBe('9876543210');
  });

  it('keeps address lines when OCR inserts blank lines between them', () => {
    const result = parseIdCardText('Resi. Address :\n\nS/O SAMPLE PARENT\n\n3/498,2E, KAMARAJ NAGAR\n\nPERUMANALLUR-641666\n\nPhone : 9876543210');
    expect(result.fields.residentialAddress).toBe('S/O SAMPLE PARENT\n3/498,2E, KAMARAJ NAGAR\nPERUMANALLUR-641666');
  });
});
