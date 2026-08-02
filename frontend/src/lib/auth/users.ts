export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'LIMITED';
  password?: string; // Only checked during login
}

export const CONFIGURED_USERS: AppUser[] = [
  {
    id: 'user-admin',
    name: 'Admin',
    email: 'admin@packwell.com',
    role: 'ADMIN',
    password: 'admin' // Simple password for local config
  },
  {
    id: 'user-limited',
    name: 'Operator',
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
