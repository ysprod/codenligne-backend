import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur pour récupérer l'utilisateur actuellement authentifié
 * L'utilisateur est attaché à request.user par le JwtStrategy
 *
 * @example
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  // Si un champ spécifique est demandé, le retourner
  return data ? user?.[data] : user;
});
