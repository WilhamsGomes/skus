import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global: importado uma vez no AppModule e disponível para todos os módulos. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
