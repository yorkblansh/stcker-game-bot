import { HandledResponse, RedisClient } from './bot.service'
import { Either, right, left } from '@sweet-monads/either'

type GETSET = 'get' | 'set'

enum Postfix {
	'-temp_chat_id' = '-temp_chat_id',
}

function monadPredicat(str: string) {
	return str && str === '22'
}

export class UserContext {
	private username: string

	constructor(
		private readonly redis: RedisClient,
		private hr: HandledResponse,
	) {
		const y = this.tempChatId('get')
	}

	private curryRedisGetSet = <
		WIN extends 'getMonad' | 'getString',
		MP extends typeof monadPredicat,
		GetReturnType = WIN extends 'getMonad' ? Either<boolean, boolean> : string,
	>(
		redis: RedisClient,
		postfix: keyof typeof Postfix,
		whatIsNeed: WIN,
		monadPredicatCB?: MP,
	) => {
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
				set: async () => await redis.set(redisArg, value as string),
			}
			return method[queryType]() as RT
		}

		return fn
	}

	// private setTempIntervalTimerList = (intervalTimerList: NodeJS.Timer[]) =>
	// 	intervalTimerList.map((intervalTimer) =>
	// 		this.intervalTimerList.push(intervalTimer),
	// 	)

	tempChatId = this.curryRedisGetSet(this.redis, '-temp_chat_id', 'getString')

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
