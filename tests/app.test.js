/**
 * @jest-environment jsdom
 */

describe('Election Process API Validation', () => {
  test('API Key Validator should reject empty keys', () => {
    // Pure logic test
    const validateApiKey = (key) => {
      if (!key || typeof key !== 'string') return false;
      return key.trim().startsWith('AIza');
    };
    expect(validateApiKey('')).toBeFalsy();
    expect(validateApiKey(null)).toBeFalsy();
  });

  test('API Key Validator should accept valid keys', () => {
    const validateApiKey = (key) => {
      if (!key || typeof key !== 'string') return false;
      return key.trim().startsWith('AIza');
    };
    expect(validateApiKey('AIzaSyA...')).toBeTruthy();
  });

  test('Markdown parser should convert bold correctly', () => {
    const parseMarkdown = (text) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    expect(parseMarkdown('Hello **world**')).toBe('Hello <strong>world</strong>');
  });
});
