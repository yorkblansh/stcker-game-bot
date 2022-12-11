import { Module } from '@nestjs/common'
import { BotService } from './bot.service'
import { HttpModule } from '@nestjs/axios'
import { FetcherModule } from '../fetcher/fetcher.module'
import { RedisModule } from '../redis/redis.module'
import { FsModule } from '../fs/fs.module'

@Module({
	imports: [HttpModule, FetcherModule, RedisModule, FsModule],
	providers: [BotService, RedisModule, FsModule],
	exports: [BotService],
})
export class BotModule {}
