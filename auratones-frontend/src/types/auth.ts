// src/types/auth.ts

export type JWTPayload = {
  uid: string;
  username?: string;
  email?: string;
  role?: string;
  plan?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown; // phòng sau này thêm trường mới
};
