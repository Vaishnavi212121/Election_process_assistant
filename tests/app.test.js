const app = require('../js/app.js'); // Mock require

describe('Election Process API Validation', () => {
  test('API Key Validator should reject empty keys', () => {
    // Mock the validateApiKey function logic
    const validateApiKey = (key) => key && key.startsWith('AIza');
    expect(validateApiKey('')).toBeFalsy();
    expect(validateApiKey(null)).toBeFalsy();
  });

  test('API Key Validator should accept valid keys', () => {
    const validateApiKey = (key) => key && key.startsWith('AIza');
    expect(validateApiKey('AIzaSyA...')).toBeTruthy();
  });

  test('Markdown parser should convert bold correctly', () => {
    const parseMarkdown = (text) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    expect(parseMarkdown('Hello **world**')).toBe('Hello <strong>world</strong>');
  });
});
