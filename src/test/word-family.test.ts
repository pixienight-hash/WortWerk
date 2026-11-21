import { describe, expect, it } from 'vitest';
import { familyMembers, resolveWordFamily, familyCatalogue } from '../lib/wortwerk-data';

const base = { id: 's', word: 'sprechen', stem: 'sprechen', family: { verbs: [{ word: 'sprechen' }, { word: 'versprechen' }, { word: 'entsprechen' }], nouns: [{ word: 'das Gespräch' }], adjectives: [{ word: 'sprachlos' }] } };
describe('explicit bidirectional word families', () => {
  it('catalogues only populated unique families and searches by any member', () => {
    const duplicate = { ...base, id: 'other' };
    expect(familyCatalogue([base, duplicate, { word: 'leer', family: {} }])).toHaveLength(1);
    expect(familyCatalogue([base], 'versprechen')).toEqual([base]);
    expect(familyCatalogue([base], 'missing')).toEqual([]);
  });
  it('sorts families alphabetically or by number of members without mutating vocabulary', () => {
    const small = { word: 'helfen', stem: 'helfen', prefixFamily: [{ word: 'helfen' }, { word: 'aushelfen' }] };
    const vocab = [base, small];
    expect(familyCatalogue(vocab).map(w => w.stem)).toEqual(['helfen', 'sprechen']);
    expect(familyCatalogue(vocab, '', 'za').map(w => w.stem)).toEqual(['sprechen', 'helfen']);
    expect(familyCatalogue(vocab, '', 'size').map(w => w.stem)).toEqual(['sprechen', 'helfen']);
    expect(vocab).toEqual([base, small]);
  });
  it('hides families consisting of empty entries or repeated copies of the base', () => {
    const empty = { word: 'sprechen', family: { verbs: [null, {}, { word: '  ' }, { word: 'sprechen' }, { word: 'SPRECHEN.' }] } };
    expect(familyMembers(empty)).toEqual([{ word: 'sprechen' }]);
    expect(resolveWordFamily(empty, [empty])).toBeUndefined();
    expect(resolveWordFamily({ word: 'allein', prefixFamily: [null, {}, { word: '' }] }, [])).toBeUndefined();
  });
  it('removes blank slots while keeping genuine relatives and ignoring malformed groups', () => {
    const mixed = { word: 'sprechen', family: { verbs: [null, { word: 'sprechen' }, { word: 'versprechen' }, { word: ' ' }], nouns: 'invalid' } };
    expect(familyMembers(mixed).map(w => w.word)).toEqual(['sprechen', 'versprechen']);
    expect(resolveWordFamily({ word: 'versprechen' }, [mixed])).toBe(mixed);
  });
  it('resolves sprechen and every listed member to the same family', () => {
    for (const member of familyMembers(base)) expect(resolveWordFamily({ word: member.word }, [base])).toBe(base);
    expect(resolveWordFamily(base, [base])).toBe(base);
  });
  it('normalizes articles, case, spaces and punctuation for existing members', () => {
    expect(resolveWordFamily({ word: '  GESPRÄCH. ' }, [base])).toBe(base);
    expect(resolveWordFamily({ word: 'Versprechen' }, [base])).toBe(base);
  });
  it('does not infer unknown members merely from spelling', () => {
    expect(resolveWordFamily({ word: 'durchsprechen' }, [base])).toBeUndefined();
  });
  it('supports legacy prefix lists without modifying saved records', () => {
    const owner = { word: 'helfen', prefixFamily: [{ word: 'helfen' }, { word: 'aushelfen' }] };
    const member = { word: 'aushelfen', learning: { timesSeen: 4, nextReview: 123 }, evidence: [{ id: 'e' }] };
    const before = JSON.stringify([owner, member]);
    expect(resolveWordFamily(member, [owner, member])).toBe(owner);
    expect(JSON.stringify([owner, member])).toBe(before);
  });
});