import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import TelegramBot from 'node-telegram-bot-api'
import { HttpService } from '@nestjs/axios'
import chunk from 'lodash.chunk'
import { FetcherService } from '../fetcher/fetcher.service'
import { Either, left, right } from '@sweet-monads/either'

import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { resolve } from 'path'
import { reject } from 'async'
import {
	InlineKeyboard,
	ReplyKeyboard,
	ForceReply,
	Row,
	KeyboardButton,
	InlineKeyboardButton,
} from 'node-telegram-keyboard-wrapper'
import { Settings } from 'http2'
import { createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

dotenv.config()

const stickers = [
	'CAACAgIAAxkBAAEaN2FjfLW1DmbXvOhTnqlpUaApMkpvdgACAQADwDZPExguczCrPy1RKwQ',
	'CAACAgIAAxkBAAEaN2JjfLW1QTUWGMk6CWPFwT2tJeMgfAAC0AcAAkb7rASgDjsQlZyXfysE',
	'CAACAgIAAxkBAAEaN2NjfLW1fz9k6ivKYE0Fyb_d_wIBfQACWwADRA3PF2b6FTNrHmEEKwQ',
	'CAACAgIAAxkBAAEaN2RjfLW1Gd8wzIjLmKPn0J3n_LNIYQACBQADwDZPE_lqX5qCa011KwQ',
	'CAACAgIAAxkBAAEaN2VjfLW1HcR2Q-PLfwwW_urtMEzLJwACIAADwZxgDGWWbaHi0krRKwQ',
	'CAACAgIAAxkBAAEaN2ZjfLW1jaGKdEy6OMFvR2gZkMORfgAC9wEAAhZCawo59nBvtGN_xCsE',
	'CAACAgIAAxkBAAEaN2djfLW1NY4IdP8xPbUQzSfS6MiMQgACWAkAAhhC7ghdxPPSm9_SQisE',
	'CAACAgIAAxkBAAEaN2hjfLW1T-ta5wVdyLcqpJcNboM47wACLAAD9wLID7xB4Mj74UDTKwQ',
	'CAACAgIAAxkBAAEaN2ljfLW1VH5g0lXbq6KqgRvghFE5tQACtAADUomRIy0lPwfkpHP6KwQ',
	'CAACAgIAAxkBAAEaN2pjfLW1flT82VNKAkaDMKW1rhoeDgACXgAD5KDOB11SuKzKYMdkKwQ',
	'CAACAgIAAxkBAAEaN2tjfLW15K39vn3NGxx1PpaBqraqFgACgw8AAuSr-UubVSA1Q28HDysE',
	'CAACAgIAAxkBAAEaN2xjfLW1zGt5ebtkQ1Wm3vfJnQkcKQAChgADRA3PF5hySbZkSauxKwQ',
	'CAACAgIAAxkBAAEaN21jfLW1BMG-C9jXQCxFfQufSWKJRwAC-gADMNSdEQaxr8KI9p3dKwQ',
	'CAACAgIAAxkBAAEaNzljfLBc2ODyt0dKC3ZBThva2s53DgACYgADlp-MDgsNmImrEBX6KwQ',
]

function get_random(list: string[]) {
	return list[Math.floor(Math.random() * list.length)]
}

interface HandledResponse {
	chatId: number
	input: RegExpExecArray['input']
	username: string
	messageId: number
}

enum Sex {
	man = 'мужской',
	woman = 'женский',
}

enum Confirmation {
	ok = 'ok',
	cancel = 'cancel',
}

const inlineKeyboard = new InlineKeyboard()

const goToGameKeyboard = new InlineKeyboard()

const confirmationKeyboard = new InlineKeyboard()

const homePageKeyboard = new InlineKeyboard()

confirmationKeyboard.push(
	/**
	 * Forcing generic type here due to InlineKeyboardButton generic.
	 * See Row's file for a better Typescript explanation
	 */

	new Row<InlineKeyboardButton>(
		new InlineKeyboardButton('Отмена❌', 'callback_data', Confirmation.cancel),
		new InlineKeyboardButton('Все верно✅', 'callback_data', Confirmation.ok),
	),
	// new Row<InlineKeyboardButton>(
	// 	new InlineKeyboardButton('2:1 Button', 'callback_data', 'Works 3!'),
	// 	new InlineKeyboardButton('2:2 Button', 'callback_data', 'Works 4!'),
	// ),
)

goToGameKeyboard.push(
	/**
	 * Forcing generic type here due to InlineKeyboardButton generic.
	 * See Row's file for a better Typescript explanation
	 */

	new Row<InlineKeyboardButton>(
		new InlineKeyboardButton('Начать играть', 'callback_data', 'start_game'),
	),
)

homePageKeyboard.push(
	/**
	 * Forcing generic type here due to InlineKeyboardButton generic.
	 * See Row's file for a better Typescript explanation
	 */

	new Row<InlineKeyboardButton>(
		new InlineKeyboardButton('🌲', 'callback_data', 'go_forest'),
		new InlineKeyboardButton('🌳', 'callback_data', 'go_forest'),
		new InlineKeyboardButton('🌴', 'callback_data', 'go_forest'),
	),
	new Row<InlineKeyboardButton>(
		new InlineKeyboardButton('🏦', 'callback_data', 'start_game'),
		new InlineKeyboardButton('🏠', 'callback_data', 'start_game'),
		new InlineKeyboardButton('🏛', 'callback_data', 'start_game'),
	),
)

inlineKeyboard.push(
	/**
	 * Forcing generic type here due to InlineKeyboardButton generic.
	 * See Row's file for a better Typescript explanation
	 */

	new Row<InlineKeyboardButton>(
		new InlineKeyboardButton('👨‍🦱', 'callback_data', Sex.man),
		new InlineKeyboardButton('👩‍🦱', 'callback_data', Sex.woman),
	),
	// new Row<InlineKeyboardButton>(
	// 	new InlineKeyboardButton('2:1 Button', 'callback_data', 'Works 3!'),
	// 	new InlineKeyboardButton('2:2 Button', 'callback_data', 'Works 4!'),
	// ),
)

@Injectable()
export class BotService implements OnModuleInit {
	private bot: TelegramBot
	private httpRequest: FetcherService['httpRequest']

	constructor(
		private readonly httpService: HttpService,
		private readonly fetcherService: FetcherService,
		@Inject('REDIS_CLIENT') private readonly redis: RedisClient,
	) {
		this.redis.set('awd', 'awd')
	}

	onModuleInit() {
		this.initBot(process.env.BOT_KEY)
		this.handleCommands()
	}

	initBot(token: string) {
		console.log('init bot')
		this.bot = new TelegramBot(token, { polling: true })
	}

	handleCommands() {
		let messageId = 0

		this.handleClient()

		this.bot.on('polling_error', (err) => console.log(err))

		this.bot.on('callback_query', async (query) => {
			const data = query.data
			const username = query.from.username
			const messageId = await this.redis.get(`${username}-temp_message_id`)
			const chatId = await this.redis.get(`${username}-temp_chat_id`)

			if (data === 'go_forest') {
				await this.bot.deleteMessage(chatId, parseInt(messageId))
				await this.bot.sendMessage(chatId, 'Вы в лесу...')
				await this.bot.sendSticker(chatId, get_random(stickers))
			}
		})

		this.bot.on('callback_query', async (query) => {
			const data = query.data
			const username = query.from.username
			const messageId = await this.redis.get(`${username}-temp_message_id`)
			const chatId = await this.redis.get(`${username}-temp_chat_id`)
			const options: TelegramBot.SendMessageOptions = {
				reply_markup: homePageKeyboard.getMarkup(),
			}

			if (data === 'start_game') {
				await this.bot.answerCallbackQuery(query.id, {
					text: 'Action received!',
				})

				// await this.bot.answerInlineQuery(query.id,)

				await this.bot.deleteMessage(chatId, parseInt(messageId))
				await this.bot
					.sendMessage(chatId, 'Домашняя страница', options)
					.then((a) => {
						this.redis.set(`${username}-temp_message_id`, a.message_id)
					})
				// await this.bot.editMessageText('Домашняя страница', {
				// 	message_id: parseInt(messageId),
				// 	chat_id: chatId,
				// })
			}
		})

		this.bot.on('callback_query', async (query) => {
			const username = query.from.username
			const data = query.data
			const chatId = await this.redis.get(`${username}-temp_chat_id`)

			if (data === Confirmation.ok || data === Confirmation.cancel) {
				if (data === Confirmation.ok) {
					const options: TelegramBot.SendMessageOptions = {
						reply_markup: goToGameKeyboard.getMarkup(),
					}

					await this.bot
						.sendMessage(chatId, 'аккаунт создан', options)
						.then(async (a) => {
							const chatId = a.chat.id
							const avatar_message_id = await this.redis.get(
								`${username}-avatar_message_id`,
							)
							const sex_message_id = await this.redis.get(
								`${username}-sex_message_id`,
							)
							const nickname_message_id = await this.redis.get(
								`${username}-nickname_message_id`,
							)
							const profile_message_id = await this.redis.get(
								`${username}-profile_message_id`,
							)
							this.redis.set(`${username}-temp_message_id`, a.message_id)

							await this.bot.deleteMessage(chatId, profile_message_id)
							await this.bot.deleteMessage(chatId, avatar_message_id)
							await this.bot.deleteMessage(chatId, sex_message_id)
							await this.bot.deleteMessage(chatId, nickname_message_id)
						})
				} else {
					await this.bot.sendMessage(
						chatId,
						'что бы пересоздать аккаунт наберите /start',
					)
				}
			}
		})

		this.bot.on('callback_query', async (query) => {
			const username = query.from.username
			const chatId = await this.redis.get(`${username}-temp_chat_id`)

			const data = query.data

			if (data === Sex.man || data === Sex.woman) {
				// await this.bot.answerCallbackQuery(query.id, { text: 'Action received!' })
				const messageId = await this.redis.get(`${username}-temp_message_id`)

				await this.bot
					.editMessageText(`вы выбрали пол:${data}`, {
						message_id: parseInt(messageId),
						chat_id: chatId,
					})
					// .sendMessage(query.from.id, `вы выбрали пол:${data}`)
					.then((a: TelegramBot.Message) => {
						const {
							chat: { username },
						} = a
						this.redis.set(`${username}-sex_message_id`, a.message_id)

						this.redis
							.set(`${username}-waiting_nickname`, 22)
							.then(async () => {
								const a = await this.redis.get(`${username}-waiting_nickname`)
								console.log(a)
							})

						this.redis.set(`${username}-sex`, data)

						this.bot
							.sendMessage(query.from.id, `напишите ваш никнейм`)
							.then((a) => {
								this.redis.set(`${username}-temp_message_id`, a.message_id)
							})
					})
			}
		})
	}

	private handleClient() {
		const handler = (hr: HandledResponse) => {
			const { chatId, username } = hr

			const options: TelegramBot.SendMessageOptions = {
				reply_markup: inlineKeyboard.getMarkup(),
			}
			this.sendReplyMessage(
				chatId,
				'Привет, мы заметили, что вы еще не использовали бот, заполните данные для дальнейшего использования\n\n выберите пол:',
				options,
			).then((a) => {
				this.redis.set(`${username}-temp_message_id`, a.message_id)
				this.redis.set(`${username}-temp_chat_id`, a.chat.id)
			})

			this.redis.set(`${username}-waiting_nickname`, 0)
			this.redis.set(`${username}-waiting_avatar`, 0).then(async () => {})

			// console.log(a)
		}

		const sexChoise = async (hr: HandledResponse) => {
			const { chatId, input, username } = hr

			if (input === Sex.man || input === Sex.woman)
				await this.sendReplyMessage(chatId, input)
		}

		const confirmation = async (hr: HandledResponse) => {
			const { chatId, input, username } = hr

			if (input === Confirmation.ok || input === Confirmation.cancel) {
				await this.sendReplyMessage(chatId, 'аккаунт создан')
			}
		}

		const nicknameChoise = async (hr: HandledResponse) => {
			const { chatId, input, username, messageId: mid } = hr

			const messageId = await this.redis.get(`${username}-temp_message_id`)

			await this.redis.get(`${username}-waiting_nickname`).then(async (a) => {
				console.log(`${username}-waiting_nickname ${a}`)
				if (a && a === '22') {
					await this.bot
						.editMessageText(`вы установили себе никнейм: ${input}`, {
							chat_id: chatId,
							message_id: parseInt(messageId),
						})
						// sendReplyMessage(
						// 	chatId,
						// 	`вы установили себе никнейм: ${input}`,
						// )
						.then((a: TelegramBot.Message) => {
							this.redis.set(`${username}-nickname_message_id`, a.message_id)
							this.redis.set(`${username}-nickname`, input)
						})

					await this.bot.deleteMessage(chatId, mid.toString())

					await this.sendReplyMessage(
						chatId,
						`Выберите себе аватарку, отправив боту смайлик`,
					).then((a) => {
						this.redis.set(`${username}-waiting_nickname`, 0)

						this.redis
							.set(`${username}-waiting_avatar`, 22)
							.then(async () => {})
						this.redis.set(`${username}-temp_message_id`, a.message_id)
					})
				}
			})
		}

		const avatarChoise = async (hr: HandledResponse) => {
			const { chatId, input, username, messageId: mid } = hr

			const messageId = await this.redis.get(`${username}-temp_message_id`)

			this.redis.get(`${username}-waiting_avatar`).then(async (a) => {
				if (a && a === '22') {
					await this.bot
						.editMessageText(`Вы выбрали аватарку-смайлик: ${input}`, {
							chat_id: chatId,
							message_id: parseInt(messageId),
						})
						// .sendReplyMessage(chatId, `Вы выбрали аватарку-смайлик: ${input}`)
						.then((a: TelegramBot.Message) => {
							this.redis.set(`${username}-avatar_message_id`, a.message_id)
							this.redis.set(`${username}-avatar`, input)
						})

					const avatar = await this.redis.get(`${username}-avatar`)
					const sex = await this.redis.get(`${username}-sex`)
					const nickname = await this.redis.get(`${username}-nickname`)

					// const options: TelegramBot.SendMessageOptions = {
					// 	reply_markup: inlineKeyboard.getMarkup(),
					// }

					await this.bot.deleteMessage(chatId, mid.toString())

					const options: TelegramBot.SendMessageOptions = {
						reply_markup: confirmationKeyboard.getMarkup(),
					}
					// await this.sendReplyMessage(
					// 	chatId,
					// 	`Ваша анкета:\n
					// 	аватар: ${avatar}
					// 	пол: ${sex}
					// 	никнейм: ${nickname}
					// 	`
					// )

					await this.sendReplyMessage(
						chatId,
						`Ваша анкета:\n
						аватар: ${avatar}
						пол: ${sex}
						никнейм: ${nickname}
						`,
						options,
					).then((a) => {
						this.redis.set(`${username}-profile_message_id`, a.message_id)
					})

					await this.redis.set(`${username}-waiting_avatar`, 0)
				}
			})
		}

		this.handleEveryCommand(/\/start/)(this.inputMessageHandler(handler))
		this.handleEveryCommand(/callback_data/)(
			this.inputMessageHandler(sexChoise),
		)
		this.handleEveryCommand(/callback_data/)(
			this.inputMessageHandler(confirmation),
		)
		this.handleEveryCommand(/(.+)/)(this.inputMessageHandler(nicknameChoise))
		this.handleEveryCommand(/(.+)/)(this.inputMessageHandler(avatarChoise))
	}

	private handleEveryCommand = (regexp: RegExp) => (commandHandlerFunction) => {
		this.bot.onText(regexp, commandHandlerFunction)
	}

	private inputMessageHandler =
		(cb) => (msg: TelegramBot.Message, match: RegExpExecArray) => {
			const chatId = msg.chat.id
			const username = msg.chat.username
			const messageId = msg.message_id
			const input = match.input
			const res: HandledResponse = { chatId, input, username, messageId }
			const isInputValid =
				input !== undefined || input !== null || input || input !== ''

			return isInputValid ? cb(res) : cb('error')
		}
	// private handleScaner() {
	// 	this.httpRequest = this.fetcherService.httpRequest
	// 	this.bot.onText(/(.+)/, async (msg, match) => {
	// 		let messageId = 0
	// 		const chatId = msg.chat.id
	// 		const links = match.input.split(/\r?\n/)
	// 		let isAlmostDone = false

	// 		const updateMesaageId = (a: TelegramBot.Message) =>
	// 			(messageId = a.message_id)

	// 		const handleStartMessage = () => {
	// 			const infoText = `Проверено: ${1} из ${links.length}`
	// 			this.sendReplyMessage(chatId, infoText).then(updateMesaageId)
	// 		}

	// 		const handleUpdateMessage = (checkedCount, cubeIndex, cubeMap) => {
	// 			const percent = (checkedCount / links.length) * 100
	// 			if (percent >= 85) isAlmostDone = true
	// 			const text = `Проверено: ${checkedCount} из ${
	// 				links.length
	// 			} (${percent.toFixed(1)}%) ${cubeMap[cubeIndex]} ${
	// 				isAlmostDone ? '\nПодготавливаем ответ...' : ''
	// 			}`
	// 			this.editMessage(chatId, text, messageId).then(updateMesaageId)
	// 		}

	// 		const promisedResults = await this.checkLinks(links, {
	// 			handleStartMessage,
	// 			handleUpdateMessage,
	// 		})
	// 		const allLinksLength = links.length
	// 		const loopCount = getLoopCount(links.length)

	// 		promisedResults.map(async (results) => {
	// 			const { chunks, linkStatusesCollection, updateInfoLoopId } =
	// 				await results
	// 			// if (allLinksLength >= 80) isAlmostDone = true
	// 			console.log('almost DONE')
	// 			if (chunks.length === loopCount + 1) {
	// 				await delayedMap({ delayMs: 300, array: chunks }, (text: any) => {
	// 					this.sendReplyMessage(chatId, text)
	// 				})
	// 				clearInterval(updateInfoLoopId)
	// 				this.sendMessage(chatId, {
	// 					ok: this.getCountOf(linkStatusesCollection, '200'),
	// 					bad: this.getCountOf(linkStatusesCollection, 'bad'),
	// 					all: this.getCountOf(linkStatusesCollection, 'all'),
	// 				})
	// 			}
	// 		})
	// 	})
	// }

	// private getCountOf = (
	// 	linkStatusesCollection,
	// 	expectedStatus: '200' | 'bad' | 'all',
	// ) =>
	// 	linkStatusesCollection
	// 		.map((linksStatuses) => {
	// 			return filterLinksStatuses(linksStatuses, expectedStatus)
	// 		})
	// 		.reduce((prev, curr) => prev.concat(curr))

	private editMessage = (
		chatId: string | number,
		text: string,
		messageId: number,
	) => {
		return this.bot.editMessageText(text, {
			chat_id: chatId,
			message_id: messageId,
		})
	}

	private sendReplyMessage = (
		chatId: string | number,
		text: string,
		options?,
	) => {
		// const messageOptions: TelegramBot.SendMessageOptions = {
		// 	reply_markup: replyKeyboard.getMarkup(),
		// }

		return this.bot.sendMessage(chatId, text, options)
	}

	// private async checkLinks(
	// 	links: string[],
	// 	{ handleStartMessage, handleUpdateMessage },
	// ) {
	// 	let chunks: string[] = []
	// 	let linkStatusesCollection: LinkStatusObject[][] = []
	// 	let checkedCount = 0
	// 	const loopCount = getLoopCount(links.length)
	// 	let startMessageSended = false

	// 	const handleLoop = async (linksPart: string[], i: number) => {
	// 		let linkStatuses: LinkStatusObject[] = []

	// 		await delayedMap(
	// 			{ array: linksPart, delayMs: 400, promisedFn: this.httpRequest },
	// 			(linksStatus) => {
	// 				checkedCount++
	// 				if (i === 0 && !startMessageSended) {
	// 					handleStartMessage()
	// 					startMessageSended = true
	// 				}
	// 				linkStatuses.push(linksStatus)
	// 			},
	// 		)

	// 		const mergedLinks = linkStatuses
	// 			.map((el) => `${el.linkName} -- ${el.status}`)
	// 			.join('\n\n')

	// 		linkStatusesCollection.push(linkStatuses)
	// 		chunks.push(mergedLinks)

	// 		return {
	// 			chunks,
	// 			linkStatusesCollection,
	// 			checkedCount,
	// 			updateInfoLoopId,
	// 		}
	// 	}

	// 	let cubeIndex = 0
	// 	const cubeMap = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪']
	// 	const updateInfoLoopId = setInterval(() => {
	// 		handleUpdateMessage(checkedCount, cubeIndex, cubeMap)
	// 		cubeIndex === cubeMap.length - 1 ? (cubeIndex = 0) : cubeIndex++
	// 	}, 500)

	// 	const chunkSize = links.length / loopCount
	// 	return chunk(links, chunkSize).map(handleLoop)
	// }
}
