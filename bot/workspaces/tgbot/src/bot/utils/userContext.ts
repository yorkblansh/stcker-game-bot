import { HandledResponse, RedisClient } from '../bot.service'
import { Either, right, left } from '@sweet-monads/either'
import TelegramBot from 'node-telegram-bot-api'
import internal from 'stream'
import { pipe } from 'fp-ts/lib/function'
import { DBFactory } from './dbFactory'

type GETSET = 'get' | 'set'

enum Postfix {
	'-temp_chat_id' = '-temp_chat_id',
	'-nickname' = '-nickname',
	'-waiting_start_hello' = '-waiting_start_hello',
	'-waiting_nickname_repeated' = '-waiting_nickname_repeated',
	'-waiting_nickname' = '-waiting_nickname',
	'-waiting_avatar' = '-waiting_avatar',
	'-temp-message-id-list' = '-temp-message-id-list',
	'-interval-timer-list' = '-interval-timer-list',
}

function monadPredicat(str: string) {
	return str && str === '22'
}

function rus(
	value: boolean | string | number | (number | string | NodeJS.Timer)[],
) {
	if (typeof value == 'boolean') return value ? 22 : 11
	if (typeof value == 'string') return value
	if (typeof value == 'number') return value.toString()
	if (Array.isArray(value))
		return JSON.stringify(value.map((v) => v.toString()))
}

export class UserContext {
	public db: DBFactory

	constructor(
		private readonly bot: TelegramBot,
		private readonly redis: RedisClient,
		public hr: HandledResponse,
	) {
		this.db = new DBFactory(this.redis, this.hr.username)
	}

	editMessage =
		(text: string, options?: TelegramBot.EditMessageTextOptions) =>
		async (messageId: string | number) => {
			try {
				this.bot.editMessageText(text, {
					parse_mode: 'HTML',
					message_id: parseInt(messageId.toString()),
					chat_id: await this.db.tempChatId('get'),
					...options,
				})
			} catch (error) {
				console.log(error)
			}
		}

	sendMessage = async (
		text: string,
		options?: TelegramBot.SendMessageOptions,
	) =>
		this.bot.sendMessage(await this.db.tempChatId('get'), text, {
			parse_mode: 'HTML',

			...options,
		})

	sendPhoto = async (photo: string | internal.Stream | Buffer) =>
		this.bot.sendPhoto(await this.db.tempChatId('get'), photo)

	deleteMessage = async (id: string | number) => {
		console.log('message deleted')
		this.bot.deleteMessage(await this.db.tempChatId('get'), id.toString())
	}

	sendSticker = async (sticker: string) =>
		this.bot.sendSticker(await this.db.tempChatId('get'), sticker)

	sendRecycledMessage = async (
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
			try {
				this.editMessage(message)(tgBotMessage.message_id)
			} catch (error) {
				console.log(error)
			}

			if (cc + 1 < messageList.length) cc++
			else cc = 0
		}, msInterval)
		setTimeout(() => clearInterval(intervalTimer), 20000)

		return { ...tgBotMessage, intervalTimer }
	}
}
