import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import { FetcherService } from '../fetcher/fetcher.service'
import { createClient } from 'redis'
import { pipe } from 'fp-ts/function'
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

type RedisClient = ReturnType<typeof createClient>

interface HandledResponse {
	chatId: number
	input: RegExpExecArray['input']
	username: string
	messageId: number
}

type kk = () => void

@Injectable()
export class BotService implements OnModuleInit {
	private bot: TelegramBot
	private httpRequest: FetcherService['httpRequest']
	private handledResponse: HandledResponse

	constructor(
		@Inject('REDIS_CLIENT') private readonly redis: RedisClient,
		private readonly httpService: HttpService,
		private readonly fetcherService: FetcherService,
	) {}

	onModuleInit() {
		this.initBot(process.env.BOT_KEY)
		this.handleCommands()
	}

	initBot(token: string) {
		console.log('init bot')
		this.bot = new TelegramBot(token, { polling: true })
	}

	handleCommands() {
		this.handleClient()
		this.bot.on('polling_error', (err) => console.log(err))
	}

	private mapHandler =
		(command: RegExp) => (handler: (args: HandledResponse) => any) =>
			this.bot.onText(command, this.inputMessageHandler(handler))

	private inputMessageHandler =
		(cb: (args: HandledResponse) => any) =>
		(msg: TelegramBot.Message, match: RegExpExecArray) => {
			const input = match.input
			this.handledResponse = {
				chatId: msg.chat.id,
				input,
				username: msg.chat.username,
				messageId: msg.message_id,
			}
			const isInputValid =
				input !== undefined || input !== null || input || input !== ''
			return isInputValid
				? cb(this.handledResponse)
				: console.log('some input error')
		}

	private handleClient() {
		this.mapHandler(/\/start/)(this.hellowMessageHandler)
	}

	private hellowMessageHandler = async (hr: HandledResponse) => {
		const { message_id } = await this.sendMessage(
			'Привет, меня зовут Черри!\nЯ помогаю освоиться новоприбывшим, а как тебя зовут?',
		)
		this.setTempMessageId(message_id)
		this.setTempChatId()
		this.setWaitingNicknameStatus(true)
		this.setWaitingAvatarStatus(false)

		// await this.bot.sendSticker(chatId, sticker.helow_cherry)

		// pipe(this.HRFeeder(hr), this.setTempChatId)

		// const { message_id } = await this.bot.sendMessage(
		// 	chatId,
		// 	'Привет, меня зовут Черри!\nЯ помогаю освоиться новоприбывшим, а как тебя зовут?',
		// )
		// this.carry(hr)
		// 	.feedTo(this.setTempChatId)
		// 	.feedTo(this.setTempMessageId(message_id))

		// await this.setTempMessageId(un, hellowMessage.message_id)
		// await this.setTempChatId(un, hellowMessage.chat.id)
	}

	// private carry = (hr: HandledResponse) => {
	// 	function feedTo(cb: (hr: HandledResponse) => any) {
	// 		cb(hr)
	// 		return { feedTo }
	// 	}
	// 	return { feedTo }
	// }

	private sendMessage = (text: string) =>
		this.bot.sendMessage(this.handledResponse.chatId, text)

	private setTempMessageId = (messageId: string | number) =>
		// ({ username }: HandledResponse) =>
		this.redis.set(
			`${this.handledResponse.username}-temp_message_id`,
			messageId,
		)

	private setTempChatId = () =>
		this.redis.set(
			`${this.handledResponse.username}-temp_chat_id`,
			this.handledResponse.chatId,
		)

	private setWaitingNicknameStatus = (status: boolean) =>
		this.redis.set(
			`${this.handledResponse.username}-waiting_nickname`,
			this.rus(status),
		)

	private async getWaitingNicknameStatus(username: string): Promise<boolean> {
		const str = await this.redis.get(`${username}-waiting_nickname`)
		return str && str === '22'
	}

	private setWaitingAvatarStatus(status: boolean) {
		return this.redis.set(`${this.handledResponse.username}-waiting_avatar`, this.rus(status))
	}

	private async getWaitingAvatarStatus(username: string): Promise<boolean> {
		const str = await this.redis.get(`${username}-waiting_avatar`)
		return str && str === '22'
	}

	/**
	 * Redis Util Status
	 */
	private rus(status: boolean) {
		return status ? 22 : 11
	}
}
