import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { BotModule } from './bot/bot.module'
import { BotService } from './bot/bot.service'
import { FsService } from './fs/fs.service';
import { FsModule } from './fs/fs.module';

@Module({
	imports: [BotModule, FsModule],
	controllers: [AppController],
	providers: [AppService, FsService],
})
export class AppModule {}
