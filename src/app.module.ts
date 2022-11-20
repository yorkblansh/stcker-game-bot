import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { BotModule } from './bot/bot.module'
import { BotService } from './bot/bot.service'
import { RedisModule } from './redis/redis.module'

@Module({
	imports: [BotModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
