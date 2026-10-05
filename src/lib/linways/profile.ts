export type ProfileField = { label: string; value: string | null };
export type ProfileSection = { title: string; fields: ProfileField[] };
export type StudentProfile = { summary: Record<string, string>; sections: ProfileSection[]; notes: string[] };

export function record(value: unknown): Record<string, unknown> {
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) { try { return record(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(', ') || null;
    const entry = record(value);
    return cleanText(entry.name ?? entry.label ?? entry.value);
  }
  if (!['string', 'number', 'boolean'].includes(typeof value)) return null;
  const entities: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  const decode = (text: string) => text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
  let text = decode(decode(String(value))).replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\\t/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/[\t\u00a0 ]+/g, ' ').trim()).filter(Boolean).join('\n').trim();
  if (/^(null|undefined|n\/?a|none|not available|not provided|-+|—)$/i.test(text)) return null;
  if (text.length > 4000) text = text.slice(0, 4000);
  return text || null;
}

function date(value: unknown) {
  const text = cleanText(value);
  if (!text || /^(0000-00-00|0)$/.test(text)) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*| .*)?$/.exec(text);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  if (!iso && !dmy) return text;
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [Number(dmy![3]), Number(dmy![2]), Number(dmy![1])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return text;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

type Definition = [string, string];
const sections: { title: string; fields: Definition[] }[] = [
  { title: 'Academic profile', fields: [['rollNo', 'Roll number'], ['registerNo', 'Register number'], ['programme', 'Programme'], ['department', 'Department'], ['campusName', 'Campus'], ['batchName', 'Batch'], ['currentSem', 'Current semester'], ['joiningSemester', 'Joining semester'], ['currentStatus', 'Academic status']] },
  { title: 'Personal information', fields: [['birthday', 'Date of birth'], ['gender', 'Gender'], ['bloodGroup', 'Blood group'], ['nationality', 'Nationality'], ['placeOfBirth', 'Place of birth'], ['motherTongue', 'Mother tongue'], ['secondLanguage', 'Second language'], ['religion', 'Religion'], ['community', 'Community'], ['caste', 'Caste'], ['subcaste', 'Subcaste'], ['category', 'Category'], ['reservation', 'Reservation'], ['seatReservation', 'Seat reservation'], ['isHostelStay', 'Hostel stay']] },
  { title: 'Contact information', fields: [['email', 'Email'], ['secondaryEmail', 'Secondary email'], ['phone', 'Mobile number'], ['state', 'State'], ['district', 'District']] },
  { title: 'Family & guardian', fields: [['fatherName', 'Father’s name'], ['fatherOccupation', 'Father’s occupation'], ['fatherPhone', 'Father’s phone'], ['fatherEmail', 'Father’s email'], ['motherName', 'Mother’s name'], ['motherOccupation', 'Mother’s occupation'], ['motherPhone', 'Mother’s phone'], ['motherEmail', 'Mother’s email'], ['parent_phone', 'Parent’s phone'], ['parentEmail', 'Parent’s email'], ['parentOccupation', 'Parent’s occupation'], ['guardianName', 'Guardian’s name'], ['guardianPhone', 'Guardian’s phone'], ['guardianLandline', 'Guardian’s landline'], ['annualIncome', 'Annual family income']] },
  { title: 'Admission & identifiers', fields: [['admissionNo', 'Admission number'], ['applicationNo', 'Application number'], ['join_date', 'Date of joining'], ['quota', 'Admission quota'], ['admissionTCNo', 'Admission TC number'], ['aadharNo', 'Aadhaar number'], ['abcId', 'ABC ID'], ['uucmsId', 'UUCMS ID'], ['capId', 'CAP ID'], ['recognitionNumber', 'Recognition number'], ['universityPRNNumber', 'University PRN'], ['rfid', 'RFID']] },
  { title: 'Previous education', fields: [['previousSchool', 'Previous school'], ['highestExamPassed', 'Highest exam passed'], ['previousPassDate', 'Previous passing date'], ['prevRegNo', 'Previous register number'], ['tenthSchool', 'Class 10 school'], ['tenthBoard', 'Class 10 board'], ['tenthYear', 'Class 10 passing year'], ['tenthRegno', 'Class 10 register number'], ['sslcPercentage', 'Class 10 percentage'], ['twelthSchool', 'Class 12 school'], ['twelthBoard', 'Class 12 board'], ['twelthYear', 'Class 12 passing year'], ['twelthRegno', 'Class 12 register number'], ['plustwoPercentage', 'Class 12 percentage'], ['entranceRank', 'Entrance rank']] },
];

export function buildProfile(summary: Record<string, unknown>, detail: Record<string, unknown>, history: Record<string, unknown>, notes: string[]): StudentProfile {
  const source = { ...record(detail.properties), ...detail };
  for (const [key, value] of Object.entries(record(detail.properties))) if (!cleanText(source[key]) && cleanText(value)) source[key] = value;
  for (const [key, value] of Object.entries(summary)) if (!cleanText(source[key])) source[key] = value;
  source.registerNo = source.registerNo ?? source.regNo ?? source.registerNumber;
  const batch = Array.isArray(source.batchDetails) ? record(source.batchDetails[0]) : {};
  source.programme = source.programme ?? batch.programName;
  source.batchName = source.batchName ?? batch.batchName;
  source.currentSem = source.currentSem ?? batch.termName;
  const getValue = (key: string) => ['birthday', 'join_date', 'previousPassDate'].includes(key) ? date(source[key]) : key.toLowerCase().includes('email') ? cleanText(source[key])?.toLowerCase() ?? null : key === 'isHostelStay' && ['0', '1', 'true', 'false'].includes(String(source[key])) ? ['1', 'true'].includes(String(source[key])) ? 'Yes' : 'No' : cleanText(source[key]);
  const formatted = sections.map((section) => ({ title: section.title, fields: section.fields.map(([key, label]) => ({ label, value: getValue(key) })) }));
  for (const [key, title] of [['currentAddress', 'Current address'], ['permanentAddress', 'Permanent address'], ['guardian_address', 'Guardian address']] as const) {
    const address = record(source[key]);
    const fields = [['house', 'House / building'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['zip', 'Postal code']].map(([field, label]) => ({ label, value: cleanText(address[field]) }));
    if (!Object.keys(address).length) fields[1].value = cleanText(source[key] ?? source[`additional_info_${key}`]);
    formatted.push({ title, fields });
  }
  const education = history.PreviousEducation ?? source.previousEducations;
  if (Array.isArray(education)) for (const [index, entry] of education.entries()) {
    const fields = Object.entries(record(entry)).filter(([key]) => !/id$|created|updated|token|password/i.test(key)).map(([key, value]) => ({ label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()), value: cleanText(value) }));
    if (fields.length) formatted.push({ title: `Education record ${index + 1}`, fields });
  }
  if (Array.isArray(history.programs)) for (const [index, entry] of history.programs.entries()) {
    const program = record(entry);
    formatted.push({ title: `Academic history ${index + 1}`, fields: [['programName', 'Programme'], ['batchName', 'Batch'], ['academicTermName', 'Semester / term'], ['academicStatus', 'Academic status'], ['campusName', 'Campus'], ['schoolName', 'School']].map(([key, label]) => ({ label, value: cleanText(program[key]) })) });
  }
  const known = new Set(sections.flatMap((section) => section.fields.map(([key]) => key)));
  const customFields = Object.entries(record(detail.properties)).filter(([key]) => !known.has(key) && !/id$|created|updated|token|password|secret|permission|image|signature|lock|trashed/i.test(key)).slice(0, 100).map(([key, value]) => ({ label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()), value: cleanText(value) }));
  if (customFields.length) formatted.push({ title: 'Additional profile information', fields: customFields });
  const cleanSummary: Record<string, string> = {};
  for (const key of ['name', 'rollNo', 'registerNo', 'programme', 'batchName', 'currentSem', 'email', 'phone']) {
    const value = getValue(key); if (value) cleanSummary[key] = value;
  }
  return { summary: cleanSummary, sections: formatted, notes };
}
