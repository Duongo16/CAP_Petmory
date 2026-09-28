/** The four permission groups, per Appendix 01 section 1. */
export enum Role {
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
  CUSTOMER = 'CUSTOMER',
}

/** Groups counted as PETMORY internal staff. */
export const INTERNAL: Role[] = [Role.MANAGER, Role.ADMIN, Role.SUPPORT];

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';
