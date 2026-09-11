/**
 * Unit tests for the markdown editor utilities used in task description editing.
 * Tests pure functions from lib/markdownEditor — no native modules required.
 */
import { applyMarkdownAction } from '../lib/markdownEditor';

describe('applyMarkdownAction — heading prefixes', () => {
  it('adds H2 prefix to a plain line', () => {
    expect(applyMarkdownAction('Hello', { start: 0, end: 0 }, 'h2')).toBe('## Hello');
  });

  it('toggles H2 off when already present', () => {
    expect(applyMarkdownAction('## Hello', { start: 0, end: 0 }, 'h2')).toBe('Hello');
  });

  it('replaces H3 with H2', () => {
    expect(applyMarkdownAction('### Hello', { start: 0, end: 0 }, 'h2')).toBe('## Hello');
  });

  it('adds H3 prefix to a plain line', () => {
    expect(applyMarkdownAction('Step', { start: 0, end: 0 }, 'h3')).toBe('### Step');
  });

  it('toggles H3 off when already present', () => {
    expect(applyMarkdownAction('### Step', { start: 0, end: 0 }, 'h3')).toBe('Step');
  });
});

describe('applyMarkdownAction — list prefixes', () => {
  it('adds bullet prefix', () => {
    expect(applyMarkdownAction('Item', { start: 0, end: 0 }, 'bullet')).toBe('- Item');
  });

  it('toggles bullet off', () => {
    expect(applyMarkdownAction('- Item', { start: 0, end: 0 }, 'bullet')).toBe('Item');
  });

  it('replaces numbered with bullet', () => {
    expect(applyMarkdownAction('1. Item', { start: 0, end: 0 }, 'bullet')).toBe('- Item');
  });

  it('adds numbered prefix', () => {
    expect(applyMarkdownAction('Step', { start: 0, end: 0 }, 'numbered')).toBe('1. Step');
  });

  it('toggles numbered off', () => {
    expect(applyMarkdownAction('1. Step', { start: 0, end: 0 }, 'numbered')).toBe('Step');
  });

  it('applies prefix only to the current line in multiline text', () => {
    const text = 'First line\nSecond line';
    const result = applyMarkdownAction(text, { start: 11, end: 11 }, 'bullet');
    expect(result).toBe('First line\n- Second line');
  });
});

describe('applyMarkdownAction — bold toggle', () => {
  it('wraps selected text with **', () => {
    const text = 'hello world';
    const result = applyMarkdownAction(text, { start: 6, end: 11 }, 'bold');
    expect(result).toBe('hello **world**');
  });

  it('uses placeholder when nothing is selected', () => {
    expect(applyMarkdownAction('', { start: 0, end: 0 }, 'bold')).toBe('**text**');
  });

  it('unwraps when selection itself is the wrapped span', () => {
    const text = 'hello **world**';
    // select "**world**" (positions 6–15)
    const result = applyMarkdownAction(text, { start: 6, end: 15 }, 'bold');
    expect(result).toBe('hello world');
  });

  it('unwraps when markers are just outside the selection', () => {
    const text = 'hello **world**';
    // inner "world" is 8–13; ** markers sit at 6-7 and 13-14
    const result = applyMarkdownAction(text, { start: 8, end: 13 }, 'bold');
    expect(result).toBe('hello world');
  });

  it('does not double-wrap (second apply unwraps)', () => {
    const text = '**word**';
    // select full "**word**"
    const result = applyMarkdownAction(text, { start: 0, end: 8 }, 'bold');
    expect(result).toBe('word');
  });
});

describe('applyMarkdownAction — italic toggle', () => {
  it('wraps selected text with *', () => {
    const text = 'hello world';
    const result = applyMarkdownAction(text, { start: 6, end: 11 }, 'italic');
    expect(result).toBe('hello *world*');
  });

  it('unwraps when selection itself is wrapped', () => {
    const text = '*world*';
    const result = applyMarkdownAction(text, { start: 0, end: 7 }, 'italic');
    expect(result).toBe('world');
  });
});

describe('plain-text compatibility', () => {
  it('applyMarkdownAction on empty string with bullet produces prefix only', () => {
    expect(applyMarkdownAction('', { start: 0, end: 0 }, 'bullet')).toBe('- ');
  });

  it('applyMarkdownAction on empty string with bold wraps placeholder', () => {
    expect(applyMarkdownAction('', { start: 0, end: 0 }, 'bold')).toBe('**text**');
  });
});
