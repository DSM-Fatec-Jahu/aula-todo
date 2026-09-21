import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthedRequest extends Request {
  user: AuthUser;
}
