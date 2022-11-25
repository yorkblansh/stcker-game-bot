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

const sticker = {
	helow_cherry:
		'CAACAgIAAxkBAAEaV6ljgPKiIyfEGiyvECpiiARnb5yjNQACBQADwDZPE_lqX5qCa011KwQ',
}

// const stickers = [
// 	'CAACAgIAAxkBAAEaN2FjfLW1DmbXvOhTnqlpUaApMkpvdgACAQADwDZPExguczCrPy1RKwQ',
// 	'CAACAgIAAxkBAAEaN2JjfLW1QTUWGMk6CWPFwT2tJeMgfAAC0AcAAkb7rASgDjsQlZyXfysE',
// 	'CAACAgIAAxkBAAEaN2NjfLW1fz9k6ivKYE0Fyb_d_wIBfQACWwADRA3PF2b6FTNrHmEEKwQ',
// 	'CAACAgIAAxkBAAEaN2RjfLW1Gd8wzIjLmKPn0J3n_LNIYQACBQADwDZPE_lqX5qCa011KwQ',
// 	'CAACAgIAAxkBAAEaN2VjfLW1HcR2Q-PLfwwW_urtMEzLJwACIAADwZxgDGWWbaHi0krRKwQ',
// 	'CAACAgIAAxkBAAEaN2ZjfLW1jaGKdEy6OMFvR2gZkMORfgAC9wEAAhZCawo59nBvtGN_xCsE',
// 	'CAACAgIAAxkBAAEaN2djfLW1NY4IdP8xPbUQzSfS6MiMQgACWAkAAhhC7ghdxPPSm9_SQisE',
// 	'CAACAgIAAxkBAAEaN2hjfLW1T-ta5wVdyLcqpJcNboM47wACLAAD9wLID7xB4Mj74UDTKwQ',
// 	'CAACAgIAAxkBAAEaN2ljfLW1VH5g0lXbq6KqgRvghFE5tQACtAADUomRIy0lPwfkpHP6KwQ',
// 	'CAACAgIAAxkBAAEaN2pjfLW1flT82VNKAkaDMKW1rhoeDgACXgAD5KDOB11SuKzKYMdkKwQ',
// 	'CAACAgIAAxkBAAEaN2tjfLW15K39vn3NGxx1PpaBqraqFgACgw8AAuSr-UubVSA1Q28HDysE',
// 	'CAACAgIAAxkBAAEaN2xjfLW1zGt5ebtkQ1Wm3vfJnQkcKQAChgADRA3PF5hySbZkSauxKwQ',
// 	'CAACAgIAAxkBAAEaN21jfLW1BMG-C9jXQCxFfQufSWKJRwAC-gADMNSdEQaxr8KI9p3dKwQ',
// 	'CAACAgIAAxkBAAEaNzljfLBc2ODyt0dKC3ZBThva2s53DgACYgADlp-MDgsNmImrEBX6KwQ',
// ]

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
				await this.bot.sendSticker(chatId, get_random([sticker.helow_cherry]))
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
		this.mapHandler(/\/start/, this.hellowMessageHandler)
		this.mapHandler(/[a-z]/, this.hellowMessageHandler)

		// this.handleEveryCommand(/callback_data/)(
		// 	this.inputMessageHandler(sexChoise),
		// )
		// this.handleEveryCommand(/callback_data/)(
		// 	this.inputMessageHandler(confirmation),
		// )
		// this.handleEveryCommand(/(.+)/)(this.inputMessageHandler(nicknameChoise))
		// this.handleEveryCommand(/(.+)/)(this.inputMessageHandler(avatarChoise))
	}

	private async nicknameChoiseHandler({
		chatId,
		username: un,
	}: HandledResponse) {
		const props = { chat_id: chatId, message_id: parseInt(messageId) }
		const status = await this.getWaitingNicknameStatus(un)

		if (status) {
			await this.bot.editMessageText(
				`Приятно познакомиться, ${input}
				Я всегда веселый, поэтому ассоциирую себя с веселым смайликом 🙂
				А с каким смайликом ассоциируешь себя ты?`,
				,
			)
		}
	}

	private async hellowMessageHandler({
		chatId,
		username: un,
	}: HandledResponse) {
		this.setWaitingNicknameStatus(un, true)
		this.setWaitingAvatarStatus(un, false)

		await this.bot.sendSticker(chatId, sticker.helow_cherry)

		const hellowMessage = await this.bot.sendMessage(
			chatId,
			'Привет, меня зовут Черри!\nЯ помогаю освоиться новоприбывшим, а как тебя зовут?',
		)

		await this.setTempMessageId(un, hellowMessage.message_id)
		await this.setTempChatId(un, hellowMessage.chat.id)
	}

	private mapHandler(command: RegExp, handler: (...args: any) => any) {
		this.bot.onText(command, this.inputMessageHandler(handler))
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

	private setTempMessageId(username: string, messageId: number | string) {
		return this.redis.set(`${username}-temp_message_id`, messageId)
	}

	private setTempChatId(username: string, chatId: number | string) {
		return this.redis.set(`${username}-temp_chat_id`, chatId)
	}

	private setWaitingNicknameStatus(username: string, status: boolean) {
		return this.redis.set(`${username}-waiting_nickname`, this.rus(status))
	}

	private async getWaitingNicknameStatus(username: string): Promise<boolean> {
		const str = await this.redis.get(`${username}-waiting_nickname`)
		return str && str === '22'
	}

	private setWaitingAvatarStatus(username: string, status: boolean) {
		return this.redis.set(`${username}-waiting_avatar`, this.rus(status))
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
