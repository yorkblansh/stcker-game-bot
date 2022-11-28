import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import { FetcherService } from '../fetcher/fetcher.service'
import { createClient } from 'redis'
import pEachSeries from 'p-each-series'
import { pipe } from 'fp-ts/function'
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { sticker } from './utils/stickers'
import { Either, right, left } from '@sweet-monads/either'

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
		const { mapRight } = await this.getWaitingStartHelloStatus()
mapRight


		const tgResponses = await this.pipeTelegramMessage([
			() =>
				this.sendMessage(
					`Добро пожаловать в Sticker Fights!  
Мир полный приключений. 
Испытай свою удачу 🎲  
Брось вызов другим игрокам ⚔  
Заводи новые знакомства, 🤝  
НЕ УПУСТИ СВОЙ ШАНС`,
				),
			() => this.sendSticker(sticker.bunny_hellow),
			() =>
				this.sendMessage(
					`Bunny Girl 
			Вижу новое лицо в нашем скромном местечке, как тебя зовут?`,
				),
		])

		this.setTempChatId()
		this.setWaitingNicknameStatus(true)
		this.setWaitingAvatarStatus(false)
		this.setTempMessageIdList(tgResponses)

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

	private pipeTelegramMessage = async (
		tgResponseList: (() => Promise<TelegramBot.Message>)[],
	) => {
		return new Promise<string[]>(async (resolve, reject) => {
			let arr: string[] = []
			await pEachSeries(tgResponseList, async (promise) => {
				const { message_id } = await promise()
				arr.push(message_id.toString())
			})
			return resolve(arr)
		})
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

	private getWaitingStartHelloStatus = async (): Promise<
		Either<boolean, boolean>
	> => {
		const str = await this.redis.get(
			`${this.handledResponse.username}-waiting_start_hello`,
		)
		return str && str === '22' ? right(true) : left(false)
	}

	private setWaitingStartHelloStatus = (status: boolean) =>
		this.redis.set(
			`${this.handledResponse.username}-waiting_start_hello`,
			this.rus(status),
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

class ExecutorPool {
	private _size: number

	constructor(size: number) {
		if (size < 1)
			throw new Error('[ExecutorPool] Размер очереди меньше единицы.')
		this._size = size
	}

	async execute(tasks: Promise<any>[]) {
		const results = Array(tasks.length)
		const executors = Array(this._size)
			.fill(null)
			.map((e, executorId) => async (taskPool) => {
				while (true) {
					const task = taskPool.pop()
					if (!task) break

					const index = taskPool.length
					results[index] = await task()
					console.log(JSON.stringify({ taskId: results[index], executorId }))
				}
			})
		const taskPool = [...tasks]
		await Promise.all(executors.map((executor) => executor(taskPool)))
		return results
	}
}
