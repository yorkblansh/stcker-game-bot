import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'
import { BotService } from './bot/bot.service.ts'

@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly botService: BotService,
	) {}

	@Get()
	getHello(): string {
		return this.appService.getHello()
	}
}
