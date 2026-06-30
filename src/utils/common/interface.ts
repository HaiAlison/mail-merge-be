import { I18nContext } from "nestjs-i18n";

export interface PaginationResponse<T> {
  otherParams: any;
  results: T[];
  offset: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}
export interface JwtPayload {
  token_type: string;
  tenant_id: string;
  client_id: string;
  is_admin: boolean;
  id: string;
  user_full_name: string;
  scopes: string;
  groups: [];
  iat: number;
  exp: number;
}
export interface IJwtToken {
  access_token: string;
}

export interface PushFileOnCloud {
  dir: string;
  data: Buffer;
  file_name: string;
  i18n?: I18nContext;

}
