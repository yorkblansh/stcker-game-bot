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
import { allowedNodeEnvironmentFlags } from 'process'

type RedisClient = ReturnType<typeof createClient>

dotenv.config()

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
		this.handleBotErrors()
	}

	handleClient() {
		this.mapHandler(/\/start/)(this.hellowMessageHandler)
	}

	private async hellowMessageHandler({
		chatId,
		username: un,
	}: HandledResponse) {
		// this.setWaitingNicknameStatus(un, true)
		// this.setWaitingAvatarStatus(un, false)

		// await this.bot.sendSticker(chatId, sticker.helow_cherry)

		await this.bot.sendMessage(
			chatId,
			'Привет, меня зовут Черри!\nЯ помогаю освоиться новоприбывшим, а как тебя зовут?',
		)

		// await this.setTempMessageId(un, hellowMessage.message_id)
		// await this.setTempChatId(un, hellowMessage.chat.id)
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

	private mapHandler(command: RegExp) {
		return function handler(args: any) {
			this.bot.onText(command, this.)
		}
	}

	handleBotErrors() {
		return this.bot.on('polling_error', (err) => console.log(err))
	}
}
