export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  role: string;
  avatarUri?: string;
  interests?: string;
};

export type LoginCredentials = {
  username: string;
  password: string;
};

export type AuthResult = {
  success: boolean;
  message?: string;
};
