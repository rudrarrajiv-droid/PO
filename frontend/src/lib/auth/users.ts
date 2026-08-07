export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'LIMITED';
  password?: string; // Only checked during login
}

export const CONFIGURED_USERS: AppUser[] = [
  {
    id: 'user-admin-rajiv',
    name: 'RAJIV PAL',
    email: 'admin@packwell.com',
    role: 'ADMIN',
    password: 'admin'
  },
  {
    id: 'user-admin-packwell',
    name: 'PACKWELL',
    email: 'packwell@packwell.com',
    role: 'ADMIN',
    password: 'packwell'
  },
  {
    id: 'user-limited-shubham',
    name: 'SHUBHAM',
    email: 'user@packwell.com',
    role: 'LIMITED',
    password: 'user'
  }
];

export const authenticate = (email: string, password: string): Omit<AppUser, 'password'> | null => {
  const user = CONFIGURED_USERS.find(u => u.email === email && u.password === password);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
};
