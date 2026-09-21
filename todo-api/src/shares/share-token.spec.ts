import { generateShareToken, hashShareToken, SHARE_TOKEN_PATTERN } from './share-token.js';

describe('share-token', () => {
  it('gera tokens de 43 caracteres base64url e unicos', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateShareToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(SHARE_TOKEN_PATTERN);
  });

  it('o hash e deterministico e diferente do token', () => {
    const token = generateShareToken();
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toContain(token);
    expect(hashShareToken(token)).toHaveLength(64);
  });
});
