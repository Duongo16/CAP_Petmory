import { SetMetadata } from '@nestjs/common';
import { Role, ROLES_KEY } from '../constants/roles';

/** Restricts an endpoint to the listed permission groups. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
