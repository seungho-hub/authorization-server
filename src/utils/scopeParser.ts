import reservedScope from '../config/scope.config.json';

export type StrScope = string;

export interface Permission {
  read: boolean;
  write: boolean;
}

export interface Scope {
  target: string;
  hierarchy: string[];
  permission: Permission;
}

// string scope가 valid format이며, reserved scope인지를 확인한다.
function isValidStrScope(strScope: string) {
  if (!isValidFormat(strScope)) return false;

  const scope = parseStrScopeToScope(strScope);

  if (!isReservedScope(scope)) return false;

  return true;
}

//scope string이 올바른 format인지 여부를 return한다.
function isValidFormat(strScope: StrScope) {
  const regex = /(\w*)(:\w*)+\.(?:read(.write)?|write(.read)?)$/;

  return regex.test(strScope);
}

//reserved scope인지 여부를 return한다.
function isReservedScope(scope: Scope) {
  let curr = reservedScope as any;

  for (let i = 0; i < scope.hierarchy.length; i++) {
    if (!curr[scope.hierarchy[i]]) return false;

    curr = curr[scope.hierarchy[i]];
  }

  return true;
}

// single scope혹은 array of scope를 strScope로 serializeq한다.
function serialize(scopes: Scope | Scope[]): StrScope {
  let result: StrScope = '';

  const _scopes: Scope[] = [];

  _scopes.concat(scopes).forEach((scope) => {
    result += parseScopeToStrScope(scope);
    result += ' ';
  });

  return result.trim();
}

// strScope를 array of scope로 deserialize한다.
function deserialize(strScopes: StrScope): Scope[] {
  const strScopesArr = strScopes.split(' ');
  const result: Scope[] = [];

  for (let i = 0; i < strScopesArr.length; i++) {
    const strScope = strScopesArr[i];

    if (!isValidFormat(strScope)) {
      throw new Error('invalid scope format');
    }

    const scope = parseStrScopeToScope(strScope);

    if (!isReservedScope(scope)) {
      throw new Error('not defineded resource');
    }

    result.push(scope);
  }

  return result;
}

// scope를 string scope로 변환한다.
function parseScopeToStrScope(scope: Scope) {
  let result = '';

  result += scope.hierarchy.join(':');

  if (scope.permission.read) result += '.read';
  if (scope.permission.write) result += '.write';

  return result;
}

// single strScope를 scope로 deserialize한다.
function parseStrScopeToScope(strScope: StrScope): Scope {
  const temp = strScope.split('.');

  // 가장 앞 dot(.) delimiter 앞의 string은 hierarchy를 나타낸다.
  const strHierarchy = temp.shift() as string;
  // 가장 앞 dot(.) delimiter앞에 위치한 hierarchy를 나타내는 string을 dequeue하면
  // 남은 array의 모든 element는 permission을 나타내는 string이다.
  const strPermissions = temp;

  // hierarchy string to array
  const hierarchy = strHierarchy.split(':');

  //hierarchy에서 : delimeter를 기준으로 가장 마지막에 위치한 string이 target이다.
  const target = strHierarchy.split(':').pop() as string;

  const permission: Permission = {
    read: false,
    write: false,
  };

  strPermissions.forEach((strPermission) => {
    switch (strPermission) {
      case 'read':
        permission.read = true;
        break;
      case 'write':
        permission.write = true;
        break;
      default:
        permission.read = false;
        permission.write = false;
        break;
    }
  });

  const result: Scope = {
    target,
    hierarchy,
    permission,
  };

  return result;
}

export default {
  serialize,
  deserialize,
  isValidFormat,
  isReservedScope,
  isValidStrScope,
};
