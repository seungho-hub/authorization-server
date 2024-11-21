import scopeParser from '../../../src/utils/scopeParser';
import Scopes from '../../data/scope.json';

describe('scopeParser', () => {
  // isValid function은 valid한 scope에 대해 true를 return해야한다.
  test('isValid(strScope(o))', () => {
    Scopes.validStringScopes.forEach((strScope) => {
      const isValid = scopeParser.isValidFormat(strScope);

      expect(isValid).toBe(true);
    });
  });

  // isValid function은 invalid한 scope에 대해 false를 return해야한다.
  test('isValid(strScope(?))', () => {
    Scopes.invalidFormatStringScope.forEach((strScope) => {
      const isValid = scopeParser.isValidFormat(strScope);

      expect(isValid).toBe(false);
    });
  });

  test('isReservedScope(hierarchy(o))', () => {
    Scopes.validScopes.forEach((scope) => {
      const isReserved = scopeParser.isReservedScope(scope);

      expect(isReserved).toBe(true);
    });
  });

  test('isReservedScope(hierarchy(?))', () => {
    Scopes.unReservedScopes.forEach((scope) => {
      const isReserved = scopeParser.isReservedScope(scope);

      expect(isReserved).toBe(false);
    });
  });

  test('deserialize(strScope(?))', () => {
    Scopes.invalidStringScopes.forEach((strScope) => {
      expect(() => {
        scopeParser.deserialize(strScope);
      }).toThrow();
    });
  });

  test('serialize and deserialize single valid Scope', () => {
    for (let i = 0; i < Scopes.validScopes.length; i++) {
      const strScope = scopeParser.serialize(Scopes.validScopes[i]);
      expect(strScope).toEqual(Scopes.validStringScopes[i]);

      const scopes = scopeParser.deserialize(strScope);
      expect(scopes).toEqual([Scopes.validScopes[i]]);
    }
  });

  test('serialize and deserialize multiple valid scope', () => {
    const strScope = scopeParser.serialize(Scopes.validScopes);
    expect(strScope).toEqual(Scopes.validMultipleStringScope);

    const scopes = scopeParser.deserialize(strScope);
    expect(scopes).toEqual(Scopes.validScopes);
  });

  test('serialize and deserialize multiple valid scope but single value', () => {
    const strScope = scopeParser.serialize([Scopes.validScopes[0]]);
    expect(strScope).toEqual(Scopes.validStringScopes[0]);

    const scopes = scopeParser.deserialize(strScope);
    expect(scopes).toEqual([Scopes.validScopes[0]]);
  });
});
