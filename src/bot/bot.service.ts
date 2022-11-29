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
import internal from 'stream'
import fs from 'fs'
import path from 'path'
import { FsService } from '../fs/fs.service'

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
		this.bot.on('polling_error', (err) => console.log(err))
	}

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
			command: /[a-z]/,
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
		this.getTempMessageIdList().map((messageId) => {
			this.deleteMessage(messageId)
		})
		this.pruneMessageIdList()
		this.deleteMessage(userMessageId)

		const tgResponses = await this.pipeTelegramMessage([
			() => this.sendSticker(sticker.nice_bunny),
			() =>
				this.sendMessage(`<b><i>Bunny Girl</i></b>
У тебя правда такое имя?`),
			() => this.sendMessage(`${input}`),
		])

		this.setWaitingNicknameStatus(false)
	}

	private hellowMessageHandler = async (hr: HandledResponse) => {
		const { messageId } = this.handledResponse
		this.deleteMessage(messageId)
		const tgResponses = await this.pipeTelegramMessage([
			() => this.sendPhoto(this.fsService.getHelloImg()),
			() =>
				this.sendMessage(
					`<b>Добро пожаловать в Sticker Fights!</b>  
<i>Мир полный приключений.</i> 
Испытай свою удачу 🎲  
Брось вызов другим игрокам ⚔  
Заводи новые знакомства, 🤝  
<b><u>НЕ УПУСТИ СВОЙ ШАНС</u></b>`,
				),
			() => this.sendSticker(sticker.bunny_hellow),
			() =>
				this.sendMessage(
					`<b><i>Bunny Girl</i></b> 
Вижу новое лицо в нашем скромном местечке, как тебя зовут?`,
				),
		])

		this.setTempChatId()
		this.setWaitingNicknameStatus(true)
		this.setWaitingAvatarStatus(false)
		this.setTempMessageIdList(tgResponses)
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

	private sendMessage = (text: string) =>
		this.bot.sendMessage(this.handledResponse.chatId, text, {
			parse_mode: 'HTML',
		})

	private sendPhoto = (photo: string | internal.Stream | Buffer) =>
		this.bot.sendPhoto(this.handledResponse.chatId, photo)

	private deleteMessage = (id: string | number) => {
		console.log('message deleted')
		this.bot.deleteMessage(this.handledResponse.chatId, id.toString())
	}

	private sendSticker = (sticker: string) =>
		this.bot.sendSticker(this.handledResponse.chatId, sticker)

	private setTempMessageIdList = (messageIdList: string[] | number[]) =>
		messageIdList.map((messageId) =>
			this.tempMessageIdList.push(messageId.toString()),
		)

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
