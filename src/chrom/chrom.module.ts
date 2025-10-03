import { Module, Global } from '@nestjs/common';
import { ChromDriverService } from './services/chrom-driver.service';

@Global()
@Module({
  providers: [ChromDriverService],
  exports: [ChromDriverService],
})
export class ChromModule {}
