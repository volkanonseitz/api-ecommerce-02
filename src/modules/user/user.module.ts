import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { ProfileController } from './controllers/profile.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { UserSecurityController } from './controllers/user-security.controller';

// Services
import { AuthService } from './services/auth.service';
import { UserCommandService } from './services/user-command.service';
import { UserQueryService } from './services/user-query.service';
import { UserSecurityService } from './services/user-security.service';
import { SocialLoginService } from './services/social-login.service';
import { PermissionService } from './services/permission.service';

// Actions
import { AttemptLoginAction } from './actions/attempt-login.action';
import { RegisterUserAction } from './actions/register-user.action';
import { UpdateUserAction } from './actions/update-user.action';
import { AdminUpdateUserAction } from './actions/admin-update-user.action';
import { ToggleUserActiveAction } from './actions/toggle-user-active.action';
import { ToggleAdminPrivilegeAction } from './actions/toggle-admin-privilege.action';
import { ChangePasswordAction } from './actions/change-password.action';

// Strategy & Guard
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AuthController,
    ProfileController,
    UserManagementController,
    UserSecurityController,
  ],
  providers: [
    // Services
    PrismaService,
    AuthService,
    UserCommandService,
    UserQueryService,
    UserSecurityService,
    SocialLoginService,
    PermissionService,
    // Actions
    AttemptLoginAction,
    RegisterUserAction,
    UpdateUserAction,
    AdminUpdateUserAction,
    ToggleUserActiveAction,
    ToggleAdminPrivilegeAction,
    ChangePasswordAction,
    // Strategy
    JwtStrategy,
  ],
  exports: [AuthService, UserQueryService, PermissionService],
})
export class UserModule {}
