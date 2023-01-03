import { Either, right, left } from '@sweet-monads/either'
import { RedisClient } from '../bot/bot.service'

enum MethodsFactoryLiteralReturnType {
	'RETURN_STRING' = 'RETURN_STRING',
	'RETURN_MONAD' = 'RETURN_MONAD',
}

type GetOrSet = 'get' | 'set'

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

const dataMapToDb = (
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

export class DbService {
	constructor(
		private readonly redis: RedisClient,
		private readonly username: string,
	) {}

	private monadPredicat = (str: string) => str && str === '22'

	private methodsFactory = <
		LiteralReturnType extends keyof typeof MethodsFactoryLiteralReturnType,
		MonadOrString = LiteralReturnType extends 'RETURN_MONAD'
			? Either<boolean, boolean>
			: string,
	>(
		postfix: keyof typeof Postfix,
		literalReturnType: LiteralReturnType,
	) => {
		const monadPredicat = this.monadPredicat
		const redis = this.redis
		const redisArg = this.username + postfix

		function fn(
			getOrSet: 'set',
			value:
				| boolean
				| string
				| number
				| (number | string | NodeJS.Timer)[],
		): Promise<string>
		function fn(getOrSet: 'get'): Promise<MonadOrString>
		function fn<
			GoS extends GetOrSet,
			ReturnType = GoS extends 'get'
				? Promise<MonadOrString>
				: Promise<string>,
		>(getOrSet: GetOrSet, value?: string): ReturnType {
			return {
				get: async () => {
					const redisResult = await redis.get(redisArg)
					return (
						literalReturnType === 'RETURN_MONAD'
							? monadPredicat(redisResult)
								? right(true)
								: left(false)
							: redisResult
					) as MonadOrString
				},
				set: async () =>
					await redis.set(redisArg, dataMapToDb(value)),
			}[getOrSet]() as ReturnType
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
		this.redis.set(
			`${username}-waiting_start_hello`,
			dataMapToDb(status),
		)
	}

	tempChatId = this.methodsFactory('-temp_chat_id', 'RETURN_STRING')

	nickname = this.methodsFactory('-nickname', 'RETURN_STRING')

	startHelloStatus = this.methodsFactory(
		'-waiting_start_hello',
		'RETURN_MONAD',
	)

	nicknameStatusRepeated = this.methodsFactory(
		'-waiting_nickname_repeated',
		'RETURN_MONAD',
	)

	nicknameStatus = this.methodsFactory(
		'-waiting_nickname',
		'RETURN_MONAD',
	)

	avatarStatus = this.methodsFactory(
		'-waiting_avatar',
		'RETURN_MONAD',
	)

	tempMessageIdList = this.methodsFactory(
		'-temp-message-id-list',
		'RETURN_STRING',
	)

	tempIntervalTimerList = this.methodsFactory(
		'-interval-timer-list',
		'RETURN_STRING',
	)

	assembledEvent = this.methodsFactory(
		'-assembled-event',
		'RETURN_STRING',
	)

	villageHintStatus = this.methodsFactory(
		'-village-hint-method-status',
		'RETURN_MONAD',
	)

	FLUSH_ALL = () => this.redis.flushAll()
}
