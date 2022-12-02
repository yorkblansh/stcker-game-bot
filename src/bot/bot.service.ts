import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import { FetcherService } from '../fetcher/fetcher.service'
import { createClient } from 'redis'
import pEachSeries from 'p-each-series'
import { pipe } from 'fp-ts/lib/function'
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { sticker } from './utils/stickers'
import { Either, right, left } from '@sweet-monads/either'
import internal from 'stream'
import fs from 'fs'
import path from 'path'
import { FsService } from '../fs/fs.service'
import { isItYourNameKBD, NameConfirmation } from './utils/keyboard'

dotenv.config()

type GETSET = 'get' | 'set'

type RedisClient = ReturnType<typeof createClient>

interface MapHandlerProps {
	command: RegExp
	handler: (args: HandledResponse) => any
	screenStateMonad: () => Promise<Either<boolean, boolean>>
}

interface HandledResponse {
	chatId: number
	input: RegExpExecArray['input']
	username: string
	messageId: number
}

@Injectable()
export class BotService implements OnModuleInit {
	private bot: TelegramBot
	private httpRequest: FetcherService['httpRequest']
	private handledResponse: HandledResponse
	private tempMessageIdList: string[] = []
	private intervalTimerList: NodeJS.Timer[] = []

	constructor(
		@Inject('REDIS_CLIENT') private readonly redis: RedisClient,
		private readonly httpService: HttpService,
		private readonly fetcherService: FetcherService,
		private readonly fsService: FsService,
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
		this.bot.on('callback_query', this.mapQueryData)
		this.bot.on('polling_error', (err) => console.log(err))
	}

	private mapQueryData = (query: TelegramBot.CallbackQuery) => {
		const queryDataHandlersMap = {
			[NameConfirmation.generic]: this.nameConfirmationHandler(query),
		}
		const index = query.data.split('.')[0]
		return queryDataHandlersMap[index][query.data]()
	}

	private menuSlidesHandler = async () => {
		const locationInfoMID = await this.pipeTelegramMessage([
			() => this.sendSticker(sticker.bunny_legs),
			() =>
				this.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Village - скромный городишко, в котором осталось преимущественно местное население.
В основном - тут нечем заняться, здесь рай для тех, кто устал от городской суеты, где постоянно кто-то куда-то спешит.`),
		])

		setTimeout(() => {
			locationInfoMID.map(this.deleteMessage)
		}, 5000)

		const locationStuffMID = await this.pipeTelegramMessage([
			() =>
				this.sendMessage(`🗺️ Локация: Village🌄
🏟 Арена: ViArana - 🆓
🏪 Магазин: Farm - 🆓`, ),
		])
	}

	private nameConfirmationHandler = (query: TelegramBot.CallbackQuery) => ({
		[NameConfirmation.yes]: async () => {
			this.setWaitingNicknameStatusRepeated(false)
			this.menuSlidesHandler()
		},
		[NameConfirmation.no]: async () => {
			this.tempMessageIdList.map(this.deleteMessage)
			this.pruneMessageIdList()
			const tgResponses = await this.pipeTelegramMessage([
				() => this.sendSticker(sticker.breaking_hart_bunny),
				() =>
					this.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Ну хорошо, скажи настоящее и я подумаю простить ли тебя`),
			])

			const { message_id: recycledMessageId, intervalTimer } =
				await this.sendRecycledMessage(500, [
					`⚠️введите имя⚠️`,
					`👇введите имя👇`,
				])
			this.setWaitingNicknameStatusRepeated(true)
			this.setTempMessageIdList([...tgResponses, recycledMessageId])
			this.setTempIntervalTimerList([intervalTimer])
			this.setWaitingNicknameStatus(true)
		},
	})

	private mapHandler = ({
		command,
		handler,
		screenStateMonad: ssm,
	}: MapHandlerProps) =>
		this.bot.onText(command, this.inputMessageHandler(command)(handler)(ssm))

	private inputMessageHandler =
		(command: RegExp) =>
		(cb: (args: HandledResponse) => any) =>
		(screenStateMonad: () => Promise<Either<boolean, boolean>>) =>
		async (msg: TelegramBot.Message, match: RegExpExecArray) => {
			const input = match.input
			this.handledResponse = {
				chatId: msg.chat.id,
				input,
				username: msg.chat.username,
				messageId: msg.message_id,
			}

			const { value: isThisScreen } = await screenStateMonad()

			const isInputValid =
				input !== undefined || input !== null || input || input !== ''

			return isInputValid && isThisScreen
				? cb(this.handledResponse)
				: console.log({ command, isInputValid, isThisScreen })
		}

	private handleClient() {
		this.mapHandler({
			command: /\/start/,
			handler: this.hellowMessageHandler,
			screenStateMonad: this.getWaitingStartHelloStatus,
		})

		this.mapHandler({
			command: /^[a-zA-Z]+$/,
			handler: this.chooseNicknameHandler,
			screenStateMonad: this.getWaitingNicknameStatus,
		})

		this.mapHandler({
			command: /\/seton/,
			handler: this.setStartOn,
			screenStateMonad: () => new Promise((res) => res(right(true))),
		})
		this.mapHandler({
			command: /\/setoff/,
			handler: this.setStartOff,
			screenStateMonad: () => new Promise((res) => res(right(true))),
		})
	}

	private setStartOn = () => this.setWaitingStartHelloStatus(true)
	private setStartOff = () => this.setWaitingStartHelloStatus(false)

	private chooseNicknameHandler = async () => {
		const { input, messageId: userMessageId } = this.handledResponse
		this.getWaitingNicknameStatusRepeated().then(
			(eitherNicknameChooseRepeated) =>
				eitherNicknameChooseRepeated
					.mapRight(async (isRepeated) => {
						const tgResponses = await this.pipeTelegramMessage([
							() => this.sendSticker(sticker.reject_bunny),
							() =>
								this.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Это точно твое имя?`),
							() => this.sendMessage(`${input}`, isItYourNameKBD().options),
						])
						this.setTempMessageIdList([...tgResponses])
					})
					.mapLeft(async (isFirstChoose) => {
						const tgResponses = await this.pipeTelegramMessage([
							() => this.sendSticker(sticker.nice_bunny),
							() =>
								this.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
У тебя правда такое имя?`),
							() => this.sendMessage(`${input}`, isItYourNameKBD().options),
						])
						this.setTempMessageIdList([...tgResponses])
					}),
		)
		this.tempMessageIdList.map(this.deleteMessage)
		this.pruneMessageIdList()
		this.deleteMessage(userMessageId)
		this.intervalTimerList.map(clearInterval)
		this.setWaitingNicknameStatus(false)
	}

	private hellowMessageHandler = async (hr: HandledResponse) => {
		this.setWaitingNicknameStatusRepeated(false)
		const { messageId: userMessageId } = this.handledResponse
		this.deleteMessage(userMessageId)
		const tgResponses = await this.pipeTelegramMessage([
			() => this.sendPhoto(this.fsService.getHelloImg()),
			() =>
				this.sendMessage(
					`<b>Добро пожаловать в Sticker Fights!</b>  
<i>Мир полный приключений.</i>   
Бросай вызов другим игрокам ⚔  
Заводи новые знакомства, 🤝  
Испытай свою удачу 🎲
<b><u>НЕ УПУСТИ СВОЙ ШАНС</u></b>`,
				),
			() => this.sendSticker(sticker.bunny_hellow),
			() =>
				this.sendMessage(
					`<b><i><u>Bunny Girl</u></i></b>
Оу, вижу новое лицо в нашем скромном местечке, как тебя зовут?`,
				),
		])

		const { message_id: recycledMessageId, intervalTimer } =
			await this.sendRecycledMessage(500, [
				`⚠️введите имя⚠️`,
				`👇введите имя👇`,
			])

		this.setTempChatId()
		this.setWaitingNicknameStatus(true)
		this.setWaitingAvatarStatus(false)
		this.setTempMessageIdList([
			...tgResponses,
			userMessageId.toString(),
			recycledMessageId,
		])
		this.setTempIntervalTimerList([intervalTimer])
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

	private getTempIntervalTimerList = () => this.intervalTimerList

	private setTempIntervalTimerList = (intervalTimerList: NodeJS.Timer[]) =>
		intervalTimerList.map((intervalTimer) =>
			this.intervalTimerList.push(intervalTimer),
		)

	private sendRecycledMessage = async (
		msInterval: number,
		messageList: string[],
		firstMessage?: string,
	) => {
		const tgBotMessage = await pipe(
			firstMessage ? firstMessage : messageList[0],
			this.sendMessage,
		)
		let cc = 0
		const intervalTimer = setInterval(async () => {
			const message = messageList[cc]
			console.log({ cc, message })
			pipe(tgBotMessage.message_id, this.editMessage(message))
			if (cc + 1 < messageList.length) cc++
			else cc = 0
		}, msInterval)
		setTimeout(() => clearInterval(intervalTimer), 100000)

		return { ...tgBotMessage, intervalTimer }
	}

	private editMessage = (text: string) => (messageId: string | number) =>
		this.bot.editMessageText(text, {
			parse_mode: 'HTML',
			message_id: parseInt(messageId.toString()),
			chat_id: this.handledResponse.chatId,
		})

	// (this.handledResponse.chatId, text, {
	// 	parse_mode: 'HTML',
	// })

	private sendMessage = (
		text: string,
		options?: TelegramBot.SendMessageOptions,
	) =>
		this.bot.sendMessage(this.handledResponse.chatId, text, {
			parse_mode: 'HTML',
			...options,
		})

	private sendPhoto = (photo: string | internal.Stream | Buffer) =>
		this.bot.sendPhoto(this.handledResponse.chatId, photo)

	private deleteMessage = (id: string | number) => {
		console.log('message deleted')
		this.bot.deleteMessage(this.handledResponse.chatId, id.toString())
	}

	private sendSticker = (sticker: string) =>
		this.bot.sendSticker(this.handledResponse.chatId, sticker)

	private setTempMessageIdList = (messageIdList: (string | number)[]) => {
		messageIdList.map((messageId) =>
			this.tempMessageIdList.push(messageId.toString()),
		)

		return this.setTempMessageIdList
	}

	private pruneMessageIdList = () => {
		this.tempMessageIdList = []
	}

	private getTempMessageIdList = () => this.tempMessageIdList

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

	private setNickname = (nickname: string) =>
		this.redis.set(`${this.handledResponse.username}-nickname`, nickname)

	private getNickname = () =>
		this.redis.get(`${this.handledResponse.username}-nickname`)

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

	private getWaitingNicknameStatusRepeated = async (): Promise<
		Either<boolean, boolean>
	> => {
		const str = await this.redis.get(
			`${this.handledResponse.username}-waiting_nickname_repeated`,
		)
		return str && str === '22' ? right(true) : left(false)
	}

	private setWaitingNicknameStatusRepeated = (status: boolean) =>
		this.redis.set(
			`${this.handledResponse.username}-waiting_nickname_repeated`,
			this.rus(status),
		)

	private setWaitingNicknameStatus = (status: boolean) =>
		this.redis.set(
			`${this.handledResponse.username}-waiting_nickname`,
			this.rus(status),
		)

	private getWaitingNicknameStatus = async (): Promise<
		Either<boolean, boolean>
	> => {
		const str = await this.redis.get(
			`${this.handledResponse.username}-waiting_nickname`,
		)
		return str && str === '22' ? right(true) : left(false)
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
