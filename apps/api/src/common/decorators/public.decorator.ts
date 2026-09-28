import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/roles';

/** Marks an endpoint that does not require a signed-in user. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
