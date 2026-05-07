const AUTHORIZED_USERS: Record<string, 'admin' | 'revisor'> = {
  'andara14@gmail.com': 'admin',
  'david@dravaautomations.com': 'admin',
  'proevolutioncourse@gmail.com': 'admin',
  'alonsoynoelia17@gmail.com': 'revisor',
  'alonkickboxer@gmail.com': 'revisor',
};

const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;
const ADMIN_ALIAS_PATTERN = /^andara14\+admin@gmail\.com$/i;
const REVISOR_ALIAS_PATTERN = /^andara14\+revisor@gmail\.com$/i;

export function getSessionRole(email: string | undefined): 'admin' | 'revisor' | null {
  if (!email) return null;
  const e = email.toLowerCase().trim();
  if (AUTHORIZED_USERS[e]) return AUTHORIZED_USERS[e];
  if (ADMIN_ALIAS_PATTERN.test(e)) return 'admin';
  if (REVISOR_ALIAS_PATTERN.test(e)) return 'revisor';
  if (TEST_USER_PATTERN.test(e)) return 'admin';
  return null;
}
