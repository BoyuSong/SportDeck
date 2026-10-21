declare module "jsonwebtoken" {
  export type JwtPayload = {
    [key: string]: unknown;
    exp?: number;
    iat?: number;
  };

  export type SignOptions = {
    expiresIn?: string | number;
  };

  export function sign(
    payload: string | Buffer | object,
    secret: string,
    options?: SignOptions
  ): string;

  export function verify(token: string, secret: string): string | JwtPayload;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}

declare module "bcrypt" {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;

  const bcrypt: {
    hash: typeof hash;
    compare: typeof compare;
  };

  export default bcrypt;
}
