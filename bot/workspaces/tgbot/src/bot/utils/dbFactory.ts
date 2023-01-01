import { Either, right, left } from '@sweet-monads/either'
import { RedisClient } from '../bot.service'

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
	'-village-hint-method-status' = '-village-hint-method-status',
	'-assembled-event' = '-assembled-event',
}

const monadPredicat = (str: string) => str && str === '22'

const rus = (
	value:
		| boolean
		| string
		| number
		| (number | string | NodeJS.Timer)[],
) => {
	if (typeof value == 'boolean') return value ? 22 : 11
	if (typeof value == 'string') return value
	if (typeof value == 'number') return value.toString()
	if (Array.isArray(value))
		return JSON.stringify(value.map((v) => v.toString()))
}

export class DBFactory {
	constructor(
		private readonly redis: RedisClient,
		private readonly username: string,
	) {}

	private dbMethodsFactory = <
		WIN extends 'getMonad' | 'getString',
		MonadOrString = WIN extends 'getMonad'
			? Either<boolean, boolean>
			: string,
	>(
		postfix: keyof typeof Postfix,
		whatIsNeed: WIN,
		monadPredicatCB?: (arg: any) => any,
	) => {
		const redis = this.redis
		const redisArg = this.username + postfix
		function fn(
			queryType: 'set',
			value:
				| boolean
				| string
				| number
				| (number | string | NodeJS.Timer)[],
		): Promise<string>
		function fn(queryType: 'get'): Promise<MonadOrString>
		function fn<
			QT extends GETSET,
			RT = QT extends 'get'
				? Promise<MonadOrString>
				: Promise<string>,
		>(queryType: GETSET, value?: string): RT {
			const method = {
				get: async () => {
					const str = await redis.get(redisArg)
					return (
						whatIsNeed === 'getMonad'
							? monadPredicatCB(str)
								? right(true)
								: left(false)
							: str
					) as MonadOrString
				},
				set: async () => await redis.set(redisArg, rus(value)),
			}
			return method[queryType]() as RT
		}

		return fn
	}

	setUserStatus = (username: string, status: boolean) => {
		console.log({
			TURN: {
				username,
				status,
			},
		})
		this.redis.set(`${username}-waiting_start_hello`, rus(status))
	}

	tempChatId = this.dbMethodsFactory('-temp_chat_id', 'getString')
	nickname = this.dbMethodsFactory('-nickname', 'getString')
	startHelloStatus = this.dbMethodsFactory(
		'-waiting_start_hello',
		'getMonad',
		monadPredicat,
	)
	nicknameStatusRepeated = this.dbMethodsFactory(
		'-waiting_nickname_repeated',
		'getMonad',
		monadPredicat,
	)
	nicknameStatus = this.dbMethodsFactory(
		'-waiting_nickname',
		'getMonad',
		monadPredicat,
	)
	avatarStatus = this.dbMethodsFactory(
		'-waiting_avatar',
		'getMonad',
		monadPredicat,
	)
	tempMessageIdList = this.dbMethodsFactory(
		'-temp-message-id-list',
		'getString',
	)
	tempIntervalTimerList = this.dbMethodsFactory(
		'-interval-timer-list',
		'getString',
	)
	assembledEvent = this.dbMethodsFactory(
		'-assembled-event',
		'getString',
	)
	villageHintStatus = this.dbMethodsFactory(
		'-village-hint-method-status',
		'getMonad',
		monadPredicat,
	)

	FLUSH_ALL = () => this.redis.flushAll()
}
