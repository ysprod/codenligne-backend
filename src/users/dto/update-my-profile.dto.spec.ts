import { ValidationPipe } from '@nestjs/common';
import { UpdateMyProfileDto } from './update-my-profile.dto';

// Même configuration que le pipe global de main.ts
const pipe = new ValidationPipe({
  transform: true,
  forbidUnknownValues: false,
  whitelist: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (body: Record<string, unknown>) =>
  pipe.transform(body, { type: 'body', metatype: UpdateMyProfileDto });

describe('UpdateMyProfileDto', () => {
  it('retire les champs de privilège envoyés par le client', async () => {
    const result = await transform({
      bio: 'Voyante depuis 10 ans',
      customPermissions: ['manage:roles'],
      role: 'SUPER_ADMIN',
      isActive: true,
      password: 'nouveau-mot-de-passe',
      username: 'autre-login',
    });

    expect(result).toEqual({ bio: 'Voyante depuis 10 ans' });
  });

  it('valide toujours les champs autorisés', async () => {
    await expect(transform({ email: 'pas-un-email' })).rejects.toBeDefined();
  });
});
