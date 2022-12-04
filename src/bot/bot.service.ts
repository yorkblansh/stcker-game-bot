import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import { FetcherService } from '../fetcher/fetcher.service'
import { createClient } from 'redis'
import pEachSeries from 'p-each-series'
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { sticker } from './utils/stickers'
import { Either, right, left } from '@sweet-monads/either'
import { FsService } from '../fs/fs.service'
import {
	isItYourNameKBD,
	NameConfirmation,
} from './utils/keyboards/isItYourNameKBD'
import { locationKBD } from './utils/keyboards/locationKBD'
import { UserContext } from './userContext'

dotenv.config()

export type RedisClient = ReturnType<typeof createClient>

interface MapHandlerProps {
	command: RegExp
	handler: (args: UserContext) => any
}

export interface HandledResponse {
	chatId: number
	input: RegExpExecArray['input']
	username: string
	messageId?: number
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
		const hr: HandledResponse = {
			chatId: query.message.chat.id,
			input: query.data,
			username: query.from.username,
			// messageId: ,
		}
		const uc = new UserContext(this.bot, this.redis, hr)
		const queryDataHandlersMap = {
			[NameConfirmation.generic]: this.nameConfirmationHandler(query),
		}
		const index = query.data.split('.')[0]
		return queryDataHandlersMap[index][query.data](uc)
	}

	private villageHintMessage = async (uc: UserContext) => {
		const locationInfoMID = await this.pipeTelegramMessage([
			() => uc.sendSticker(sticker.bunny_legs),
			() =>
				uc.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Village - скромный городишко, в котором осталось преимущественно местное население.
В основном - тут нечем заняться, здесь рай для тех, кто устал от городской суеты, где постоянно кто-то куда-то спешит.`),
		])

		setTimeout(() => {
			locationInfoMID.map(uc.deleteMessage)
		}, 10000)
	}

	private menuSlidesHandler = async (uc: UserContext) => {
		await this.villageHintMessage(uc)

		const locationStuffMID = await this.pipeTelegramMessage([
			() =>
				uc.sendMessage(
					`🗺️ Локация: Village🌄
🏟 Арена: ViArana - 🆓
🏪 Магазин: Farm - 🆓`,
					locationKBD({ middleButton: `🌚` }).options,
				),
		])
	}

	private nameConfirmationHandler = (query: TelegramBot.CallbackQuery) => ({
		[NameConfirmation.yes]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.tempMessageIdList('get'),
			) as string[]
			tempMessageIdList.map(uc.deleteMessage)

			uc.nicknameStatusRepeated('set', false)
			this.menuSlidesHandler(uc)
		},
		[NameConfirmation.no]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.tempMessageIdList('get'),
			) as string[]
			tempMessageIdList.map(uc.deleteMessage)
			const tgResponses = await this.pipeTelegramMessage([
				() => uc.sendSticker(sticker.breaking_hart_bunny),
				() =>
					uc.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Ну хорошо, скажи настоящее и я подумаю простить ли тебя`),
			])

			const { message_id: recycledMessageId, intervalTimer } =
				await uc.sendRecycledMessage(500, [
					`⚠️введите имя⚠️`,
					`👇введите имя👇`,
				])
			uc.nicknameStatusRepeated('set', true)
			uc.tempMessageIdList('set', [...tgResponses, recycledMessageId])

			uc.tempIntervalTimerList('set', [intervalTimer])
			uc.nicknameStatus('set', true)
		},
	})

	private mapHandler = ({ command, handler }: MapHandlerProps) =>
		this.bot.onText(command, this.inputMessageHandler(command)(handler))

	private inputMessageHandler =
		(command: RegExp) =>
		(handlerCallBack: (args: UserContext) => any) =>
		async (msg: TelegramBot.Message, match: RegExpExecArray) => {
			const input = match.input
			const hr: HandledResponse = {
				chatId: msg.chat.id,
				input,
				username: msg.chat.username,
				messageId: msg.message_id,
			}
			const uc = new UserContext(this.bot, this.redis, hr)
			uc.tempChatId('set', hr.chatId)

			const isInputValid =
				input !== undefined || input !== null || input || input !== ''

			return isInputValid
				? handlerCallBack(uc)
				: console.log({ command, isInputValid })
		}

	private handleClient() {
		this.mapHandler({
			command: /\/start/,
			handler: this.hellowMessageHandler,
		})

		this.mapHandler({
			command: /^[a-zA-Zа-яА-ЯёЁ]+$/,
			handler: this.chooseNicknameHandler,
		})

		this.mapHandler({
			command: /\/seton/,
			handler: this.setStartOn,
		})
		this.mapHandler({
			command: /\/setoff/,
			handler: this.setStartOff,
		})
	}

	private setStartOn = (uc: UserContext) => uc.startHelloStatus('set', true)
	private setStartOff = (uc: UserContext) => uc.startHelloStatus('set', false)

	private chooseNicknameHandler = async (uc: UserContext) => {
		const { input, messageId: userMessageId } = uc.hr
		uc.nicknameStatusRepeated('get').then((eitherNicknameChooseRepeated) =>
			eitherNicknameChooseRepeated
				.mapRight(async (isRepeated) => {
					const tgResponses = await this.pipeTelegramMessage([
						() => uc.sendSticker(sticker.reject_bunny),
						() =>
							uc.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Это точно твое имя?`),
						() => uc.sendMessage(`${input}`, isItYourNameKBD().options),
					])
					uc.tempMessageIdList('set', [...tgResponses])
				})
				.mapLeft(async (isFirstChoose) => {
					const tgResponses = await this.pipeTelegramMessage([
						() => uc.sendSticker(sticker.nice_bunny),
						() =>
							uc.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
У тебя правда такое имя?`),
						() => uc.sendMessage(`${input}`, isItYourNameKBD().options),
					])
					uc.tempMessageIdList('set', [...tgResponses])
				}),
		)
		const tempMessageIdList = JSON.parse(
			await uc.tempMessageIdList('get'),
		) as string[]
		tempMessageIdList.map(uc.deleteMessage)

		uc.tempMessageIdList('set', '')
		uc.deleteMessage(userMessageId)

		const tempIntervalTimerList = JSON.parse(
			await uc.tempIntervalTimerList('get'),
		) as string[]
		tempIntervalTimerList.map(clearInterval)

		uc.nicknameStatus('set', false)
	}

	private hellowMessageHandler = async (uc: UserContext) =>
		(await uc.startHelloStatus('get')).mapRight(async () => {
			uc.nicknameStatusRepeated('set', false)
			const { messageId: userMessageId } = uc.hr
			uc.deleteMessage(userMessageId)
			const tgResponses = await this.pipeTelegramMessage([
				() => uc.sendPhoto(this.fsService.getHelloImg()),
				() =>
					uc.sendMessage(
						`<b>Добро пожаловать в Sticker Fights!</b>  
	<i>Мир полный приключений.</i>   
	Бросай вызов другим игрокам ⚔  
	Заводи новые знакомства, 🤝  
	Испытай свою удачу 🎲
	<b><u>НЕ УПУСТИ СВОЙ ШАНС</u></b>`,
					),
				() => uc.sendSticker(sticker.bunny_hellow),
				() =>
					uc.sendMessage(
						`<b><i><u>Bunny Girl</u></i></b>
	Оу, вижу новое лицо в нашем скромном местечке, как тебя зовут?`,
					),
			])

			const { message_id: recycledMessageId, intervalTimer } =
				await uc.sendRecycledMessage(500, [
					`⚠️введите имя⚠️`,
					`👇введите имя👇`,
				])

			uc.nicknameStatus('set', true)
			uc.avatarStatus('set', false)
			uc.tempMessageIdList('set', [
				...tgResponses,
				userMessageId,
				recycledMessageId,
			])
			uc.tempIntervalTimerList('set', [intervalTimer])
		})

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
}
