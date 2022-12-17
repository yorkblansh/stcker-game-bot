import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import { FetcherService } from '../fetcher/fetcher.service'
import { createClient } from 'redis'
import pEachSeries from 'p-each-series'
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { sticker } from './utils/stickers'
import { FsService } from '../fs/fs.service'
import {
	isItYourNameKBD,
	NameConfirmation,
} from './utils/keyboards/isItYourNameKBD'
import { locationKBD, LocationSwitch } from './utils/keyboards/locationKBD'
import { UserContext } from './utils/userContext'
import { WaitArena, waitArenaKBD } from './utils/keyboards/waitArenaKBD'
import { io, Socket } from 'socket.io-client'
import { pipe } from 'fp-ts/lib/function'
import { FightMode, fightModeKDB } from './utils/keyboards/fightModeKBD'

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

interface FightUserUpdate {
	damager: {
		username: string
		health: number
	}
	opponent: {
		username: string
		health: number
	}
}
@Injectable()
export class BotService implements OnModuleInit {
	private bot: TelegramBot
	private fight: {
		waitingRoom: string[]
		busyPlayers: string[]
		notFightingPlayes: string[]
	}
	private socket: Socket

	constructor(
		@Inject('REDIS_CLIENT') private readonly redis: RedisClient,
		private readonly httpService: HttpService,
		private readonly fetcherService: FetcherService,
		private readonly fsService: FsService,
	) {
		this.fight = {
			waitingRoom: [],
			busyPlayers: [],
			notFightingPlayes: [],
		}
	}

	onModuleInit() {
		this.initBot(process.env.BOT_KEY)
		this.handleCommands()

		this.socket = io('http://localhost:4040/')

		// client-side
		this.socket.on('connect', () => {
			console.log(this.socket.id) // x8WIv7-mJelg7on_ALbx
		})

		this.socket.on('disconnect', () => {
			console.log(this.socket.id) // undefined
		})
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
			[LocationSwitch.generic]: this.postoyalets(query),
			[WaitArena.generic]: this.arenaConfirmation(query),
			[FightMode.generic]: this.makeDamage(query),
		}
		const index = query.data.split('.')[0]
		console.log({ index, query_data: query.data })
		return queryDataHandlersMap[index][query.data](uc)
	}

	private arenaConfirmation = (query: TelegramBot.CallbackQuery) => ({
		[WaitArena.back]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.db.tempMessageIdList('get'),
			) as string[]
			tempMessageIdList.map(uc.deleteMessage)
			this.menuSlidesHandler(uc)
		},
		[WaitArena.fight]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.db.tempMessageIdList('get'),
			) as string[]
			tempMessageIdList.map(uc.deleteMessage)

			const mid = await this.pipeTelegramMessage([
				() => uc.sendMessage(`waiting for concurent`),
			])

			uc.db.tempMessageIdList('set', [...mid])

			this.socket.on('fight_status', async (fightStatus: boolean) => {
				pipe(
					mid[0],
					fightStatus
						? uc.editMessage('соперинк найден!')
						: uc.editMessage('идет поиск соперника...'),
				)

				if (fightStatus) {
					mid.map(uc.deleteMessage)
				}
			})

			console.log('here must be test')

			this.socket.emit('add_user', uc.hr.username)
			console.log({ username: uc.hr.username })
			// if (uc.hr.username === 'yorkblansh1')
			this.socket.on(`assembled_event_${uc.hr.username}`, (data) => {
				uc.db.assembledEvent('set', data)
				console.log({ [`for_${uc.hr.username}`]: data })
				this.fightMode(uc)
			})
		},
	})

	private fightMode = async (uc: UserContext) => {
		const fightMessage = (
			userHealth: number,
			opponentHealth: number,
		) => `мое здоровье: ${userHealth}
здоровье противника: ${opponentHealth}`

		uc.db
			.assembledEvent('get')
			.then((assembledEvent) => {
				this.pipeTelegramMessage([
					() => uc.sendMessage(fightMessage(100, 100), fightModeKDB().options),
				]).then((fightMessages) => {
					const aggregateUserUpdate = (data: FightUserUpdate) => {
						console.log({ fight_user_update: data })
						// учиттывать что бы у атакующего и оппонента были разные никнеймы
						if (data.damager.username === uc.hr.username)
							return { me: data.damager, opponent: data.opponent }
						else if (data.opponent.username === uc.hr.username)
							return { me: data.opponent, opponent: data.damager }
					}
					console.log({ aaaaa: `${assembledEvent}_user_update` })

					this.socket.on(
						`${assembledEvent}_user_update`,
						(data: FightUserUpdate) => {
							console.log({ _user_update: 'exist' })
							const { me, opponent } = aggregateUserUpdate(data)
							pipe(
								fightMessages[0],
								uc.editMessage(
									fightMessage(me.health, opponent.health),
									fightModeKDB().editMessageOptions,
								),
							)
						},
					)
				})
			})
			.catch((er) => {
				console.log({ asmbleDATA_ERROR: er })
			})
	}

	private makeDamage = (query: TelegramBot.CallbackQuery) => ({
		[FightMode.damage]: async (uc: UserContext) => {
			console.log({ damage_from: uc.hr.username })
			const assembledEvent = await uc.db.assembledEvent('get')

			this.socket.emit(`${assembledEvent}_damage`, {
				damagerUsername: uc.hr.username,
			})
		},
	})

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
		const isHintVillageMessage = (await uc.db.villageHintStatus('get')).value
		if (isHintVillageMessage) await this.villageHintMessage(uc)

		const locationStuffMID = await this.pipeTelegramMessage([
			() =>
				uc.sendMessage(
					`🗺️ Локация: Village🌄
🏟 Арена: ViArana - 🆓
🏪 Магазин: Farm - 🆓`,
					locationKBD({ middleButton: `Location info` }).options,
				),
		])

		uc.db.villageHintStatus('set', false)
		uc.db.tempMessageIdList('set', [...locationStuffMID])
	}

	private nameConfirmationHandler = (query: TelegramBot.CallbackQuery) => ({
		[NameConfirmation.yes]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.db.tempMessageIdList('get'),
			) as string[]
			tempMessageIdList.map(uc.deleteMessage)

			uc.db.nicknameStatusRepeated('set', false)
			this.menuSlidesHandler(uc)
		},
		[NameConfirmation.no]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.db.tempMessageIdList('get'),
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
			uc.db.nicknameStatusRepeated('set', true)
			uc.db.tempMessageIdList('set', [
				...tgResponses,
				recycledMessageId
			])

			uc.db.tempIntervalTimerList('set', [
				intervalTimer
			])
			uc.db.nicknameStatus('set', true)
		},
	})

	private mapHandler = ({ command, handler }: MapHandlerProps) =>
		this.bot.onText(command, this.inputMessageHandler(command)(handler))

	private inputMessageHandler =
		(command: RegExp) =>
		(handlerCallBack: (args: UserContext, _input?: string) => any) =>
		async (msg: TelegramBot.Message, match: RegExpExecArray) => {
			const input = match.input
			const hr: HandledResponse = {
				chatId: msg.chat.id,
				input,
				username: msg.chat.username,
				messageId: msg.message_id,
			}
			const uc = new UserContext(this.bot, this.redis, hr)
			uc.db.tempChatId('set', hr.chatId)

			const isInputValid =
				input !== undefined || input !== null || input || input !== ''

			return isInputValid
				? handlerCallBack(uc, input)
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
			command: /\/seton.[a-zA-Z]/,
			handler: this.setUserStatus(true),
		})
		this.mapHandler({
			command: /\/setoff.[a-zA-Z]/,
			handler: this.setUserStatus(false),
		})

		// this.mapHandler({
		// 	command: /\/seton/,
		// 	handler: this.setStartOn,
		// })
		// this.mapHandler({
		// 	command: /\/setoff/,
		// 	handler: this.setStartOff,
		// })
	}

	private setUserStatus =
		(status: boolean) => (uc: UserContext, _input?: string) =>
			uc.db.setUserStatus(_input.split('.')[1].toString(), status)

	private setStartOn = (uc: UserContext) => uc.db.startHelloStatus('set', true)
	private setStartOff = (uc: UserContext) =>
		uc.db.startHelloStatus('set', false)

	private chooseNicknameHandler = async (uc: UserContext) => {
		const { input, messageId: userMessageId } = uc.hr
		uc.db.nicknameStatusRepeated('get').then((eitherNicknameChooseRepeated) =>
			eitherNicknameChooseRepeated
				.mapRight(async (isRepeated) => {
					const tgResponses = await this.pipeTelegramMessage([
						() => uc.sendSticker(sticker.reject_bunny),
						() =>
							uc.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
Это точно твое имя?`),
						() => uc.sendMessage(`${input}`, isItYourNameKBD().options),
					])
					uc.db.tempMessageIdList('set', [...tgResponses])
				})
				.mapLeft(async (isFirstChoose) => {
					const tgResponses = await this.pipeTelegramMessage([
						() => uc.sendSticker(sticker.nice_bunny),
						() =>
							uc.sendMessage(`<b><i><u>Bunny Girl</u></i></b>
У тебя правда такое имя?`),
						() => uc.sendMessage(`${input}`, isItYourNameKBD().options),
					])
					uc.db.tempMessageIdList('set', [...tgResponses])
				}),
		)
		const tempMessageIdList = JSON.parse(
			await uc.db.tempMessageIdList('get'),
		) as string[]
		tempMessageIdList.map(uc.deleteMessage)

		uc.db.tempMessageIdList('set', '')
		uc.deleteMessage(userMessageId)

		const tempIntervalTimerList = JSON.parse(
			await uc.db.tempIntervalTimerList('get'),
		) as string[]
		tempIntervalTimerList.map(clearInterval)

		uc.db.nicknameStatus('set', false)
	}

	private hellowMessageHandler = async (uc: UserContext) =>
		(await uc.db.startHelloStatus('get')).mapRight(async () => {
			uc.db.villageHintStatus('set', true)
			uc.db.nicknameStatusRepeated('set', false)
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

			uc.db.nicknameStatus('set', true)
			uc.db.avatarStatus('set', false)
			uc.db.tempMessageIdList('set', [
				...tgResponses,
				userMessageId,
				recycledMessageId,
			])
			uc.db.tempIntervalTimerList('set', [intervalTimer])
		})

	private postoyalets = (query: TelegramBot.CallbackQuery) => ({
		[LocationSwitch.arena]: async (uc: UserContext) => {
			const tempMessageIdList = JSON.parse(
				await uc.db.tempMessageIdList('get'),
			) as string[]
			tempMessageIdList.map(uc.deleteMessage)

			const tgResponses = await this.pipeTelegramMessage([
				() => uc.sendSticker(sticker.postoyalets),
				() =>
					uc.sendMessage(
						`<b><i><u>Постоялец</u></i></b>  
Хэ-Гэй, решил испытать свою живность?
Могу тебя понять, развлечений тут не много...
Это бесплатно, думай скорее.`,
					),
				() =>
					uc.sendMessage(
						`<b><i><u>ℹ️info</u></i></b>
Арена Бар
Ставка - 0₽`,
						waitArenaKBD().options,
					),
			])

			uc.db.tempMessageIdList('set', [...tgResponses])
		},
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
