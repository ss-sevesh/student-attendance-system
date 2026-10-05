import { expect, it } from 'vitest';
import { buildProfile, cleanText } from '../../src/lib/linways/profile';

it('formats messy portal text and empty values without inventing information', () => {
  expect(cleanText('  Road&nbsp;  1<br> Town\\nState ')).toBe('Road 1\nTown\nState');
  expect(cleanText('&lt;b&gt;A &amp; B&lt;/b&gt;')).toBe('A & B');
  expect(cleanText('<script>malicious()</script> A')).toBe('A');
  expect(cleanText({ id: 'internal', name: '  India  ' })).toBe('India');
  expect(cleanText('&#x27;Test&#39;')).toBe("'Test'");
  for (const value of [null, '', '  ', 'NULL', 'undefined', 'N/A', '---']) expect(cleanText(value)).toBeNull();
  expect(cleanText(0)).toBe('0');
});

it('retains explicit missing fields, formats dates, and excludes internal metadata', () => {
  const profile = buildProfile({ name: 'Test Student', rollNo: 'TEST01' }, { birthday: '2006-05-11', gender: '', nationality: { id: 'hidden', name: 'India' }, properties: '{"customNote":" Text &amp; more ","secretToken":"hidden"}', permanentAddress: { city: 'Town', zip: '123456' }, createdBy: 'hidden' }, {}, []);
  expect(profile.sections.find((section) => section.title === 'Personal information')?.fields).toContainEqual({ label: 'Gender', value: null });
  expect(profile.sections.find((section) => section.title === 'Personal information')?.fields).toContainEqual({ label: 'Date of birth', value: '11 May 2006' });
  expect(profile.sections.find((section) => section.title === 'Additional profile information')?.fields).toEqual([{ label: 'Custom Note', value: 'Text & more' }]);
  expect(JSON.stringify(profile)).not.toContain('hidden');
});
