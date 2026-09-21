import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';

const BCRYPT_COST = 12;
// Hash descartavel: mantem o tempo de resposta do login igual quando o e-mail nao existe.
const DUMMY_HASH = bcrypt.hashSync('senha-que-nunca-sera-usada', BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    try {
      const user = await this.prisma.user.create({
        data: { name: dto.name.trim(), email: dto.email, passwordHash },
      });
      return this.session(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail ja cadastrado');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new UnauthorizedException('E-mail ou senha invalidos');
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, name: user.name, email: user.email };
  }

  private async session(user: { id: string; name: string; email: string }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { accessToken, user: { id: user.id, name: user.name, email: user.email } };
  }
}
