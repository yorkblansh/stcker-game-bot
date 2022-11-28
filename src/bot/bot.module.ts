import { Module } from '@nestjs/common'
import { BotService } from './bot.service'
import { HttpModule } from '@nestjs/axios'
import { FetcherModule } from '../fetcher/fetcher.module'
import { RedisModule } from '../redis/redis.module'

@Module({
	imports: [HttpModule, FetcherModule, RedisModule],
	providers: [BotService, RedisModule],
	exports: [BotService],
})
export class BotModule {}
