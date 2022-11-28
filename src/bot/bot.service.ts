import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import { FetcherService } from '../fetcher/fetcher.service'
import { createClient } from 'redis'
import { pipe } from 'fp-ts/function'
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { sticker } from './utils/stickers'
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
	private tempMessageIdList: string[] = []

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
		this.mapHandler(/\/check/)(this.checkRedisData)
	}

	private hellowMessageHandler = async (hr: HandledResponse) => {
		const tgResponses = await this.pipeTelegramMessage([
			this.sendMessage(
				`Добро пожаловать в Sticker Fights!  
Мир полный приключений. 
Испытай свою удачу 🎲  
Брось вызов другим игрокам ⚔  
Заводи новые знакомства, 🤝  
НЕ УПУСТИ СВОЙ ШАНС`,
			),
			this.sendSticker(sticker.bunny_hellow),
			this.sendMessage(
				`Bunny Girl 
			Вижу новое лицо в нашем скромном местечке, как тебя зовут?`,
			),
		])

		await this.setTempChatId()
		await this.setWaitingNicknameStatus(true)
		await this.setWaitingAvatarStatus(false)
		this.setTempMessageIdList(tgResponses.map(({ message_id }) => message_id))

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

	private pipeTelegramMessage = (
		tgResponseList: Promise<TelegramBot.Message>[],
	) => {
		return Promise.all(
			tgResponseList.map(async (tgResponse) => {
				const { message_id } = await tgResponse
				return { message_id }
			}),
		)
	}

	private checkRedisData = async () => {
		const nicknameStatus = await this.getWaitingNicknameStatus()
		const avatarStatus = await this.getWaitingAvatarStatus()

		console.log({
			nicknameStatus,
			avatarStatus,
		})
	}

	// private carry = (hr: HandledResponse) => {
	// 	function feedTo(cb: (hr: HandledResponse) => any) {
	// 		cb(hr)
	// 		return { feedTo }
	// 	}
	// 	return { feedTo }
	// }

	private sendMessage = (sticker: string) =>
		this.bot.sendMessage(this.handledResponse.chatId, sticker)

	private sendSticker = (text: string) =>
		this.bot.sendSticker(this.handledResponse.chatId, text)

	private setTempMessageIdList = (messageIdList: string[] | number[]) =>
		messageIdList.map((messageId) =>
			this.tempMessageIdList.push(messageId.toString()),
		)

	private getTempMessageIdList = (messageIdList: string[] | number[]) =>
		this.tempMessageIdList

	// ({ username }: HandledResponse) =>
	// this.redis.set(
	// 	`${this.handledResponse.username}-temp_message_id`,
	// 	messageId,
	// )

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

	private getWaitingNicknameStatus = async () => {
		const str = await this.redis.get(
			`${this.handledResponse.username}-waiting_nickname`,
		)
		return str && str === '22'
	}

	private setWaitingAvatarStatus = (status: boolean) => {
		return this.redis.set(
			`${this.handledResponse.username}-waiting_avatar`,
			this.rus(status),
		)
	}

	private getWaitingAvatarStatus = async () => {
		const str = await this.redis.get(
			`${this.handledResponse.username}-waiting_avatar`,
		)
		return str && str === '22'
	}

	/**
	 * Redis Util Status
	 */
	private rus(status: boolean) {
		return status ? 22 : 11
	}
}
