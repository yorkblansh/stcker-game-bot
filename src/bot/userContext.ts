import { HandledResponse, RedisClient } from './bot.service'
import { Either, right, left } from '@sweet-monads/either'
import TelegramBot from 'node-telegram-bot-api'
import internal from 'stream'
import { pipe } from 'fp-ts/lib/function'

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

function rus(status: boolean) {
	return status ? 22 : 11
}

export class UserContext {
	private username: string

	constructor(
		private readonly bot: TelegramBot,
		private readonly redis: RedisClient,
		private hr: HandledResponse,
	) {
		const y = this.nickname('get')
	}

	private dbMethodsFactory = <
		WIN extends 'getMonad' | 'getString',
		MP extends typeof monadPredicat,
		GetReturnType = WIN extends 'getMonad' ? Either<boolean, boolean> : string,
	>(
		postfix: keyof typeof Postfix,
		whatIsNeed: WIN,
		monadPredicatCB?: MP,
	) => {
		const redis = this.redis
		const redisArg = this.username + postfix
		function fn(queryType: 'set', value: string): Promise<string>
		function fn(queryType: 'get'): Promise<GetReturnType>
		function fn<
			QT extends GETSET,
			RT = QT extends 'get' ? Promise<GetReturnType> : Promise<string>,
		>(queryType: GETSET, value?: string): RT {
			const method = {
				get: async () => {
					const str = await redis.get(redisArg)
					return (
						monadPredicatCB
							? monadPredicatCB(str)
								? right(true)
								: left(false)
							: str
					) as GetReturnType
				},
				set: async () => await redis.set(redisArg, this.rus(value)),
			}
			return method[queryType]() as RT
		}

		return fn
	}

	// private setTempIntervalTimerList = (intervalTimerList: NodeJS.Timer[]) =>
	// 	intervalTimerList.map((intervalTimer) =>
	// 		this.intervalTimerList.push(intervalTimer),
	// 	)

	tempChatId = this.dbMethodsFactory('-temp_chat_id', 'getString')
	nickname = this.dbMethodsFactory('-nickname', 'getString')
	startHelloStatus = this.dbMethodsFactory('-waiting_start_hello', 'getMonad')
	nicknameStatusRepeated = this.dbMethodsFactory(
		'-waiting_nickname_repeated',
		'getMonad',
	)
	nicknameStatus = this.dbMethodsFactory('-waiting_nickname', 'getMonad')
	avatarStatus = this.dbMethodsFactory('-waiting_avatar', 'getMonad')
	tempMessageIdList = this.dbMethodsFactory(
		'-temp-message-id-list',
		'getString',
	)
	tempIntervalTimerList = this.dbMethodsFactory(
		'-interval-timer-list',
		'getString',
	)

	editMessage = (text: string) => async (messageId: string | number) =>
		this.bot.editMessageText(text, {
			parse_mode: 'HTML',
			message_id: parseInt(messageId.toString()),
			chat_id: await this.tempChatId('get'),
		})

	sendMessage = async (
		text: string,
		options?: TelegramBot.SendMessageOptions,
	) =>
		this.bot.sendMessage(await this.tempChatId('get'), text, {
			parse_mode: 'HTML',
			...options,
		})

	sendPhoto = async (photo: string | internal.Stream | Buffer) =>
		this.bot.sendPhoto(await this.tempChatId('get'), photo)

	deleteMessage = async (id: string | number) => {
		console.log('message deleted')
		this.bot.deleteMessage(await this.tempChatId('get'), id.toString())
	}

	sendSticker = async (sticker: string) =>
		this.bot.sendSticker(await this.tempChatId('get'), sticker)

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
			pipe(tgBotMessage.message_id, this.editMessage(message))
			if (cc + 1 < messageList.length) cc++
			else cc = 0
		}, msInterval)
		setTimeout(() => clearInterval(intervalTimer), 100000)

		return { ...tgBotMessage, intervalTimer }
	}

	/**
	 * Redis Util Status
	 */

	// private redisQuery=()=>{

	// }
}

// <
// 			QT extends GETSET,
// 			MP extends typeof monadPredicat,
// 			ReturnType = QT extends 'get'
// 				? MP extends undefined
// 					? Promise<string>
// 					: Promise<Either<boolean, boolean>>
// 				: Promise<string>,
// 		>
