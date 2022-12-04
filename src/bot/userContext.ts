import { HandledResponse, RedisClient } from './bot.service'

type GETSET = 'get' | 'set'

export class UserContext {
	constructor(
		private readonly redis: RedisClient,
		private hr: HandledResponse,
	) {
		this.tempChatId('get')
	}

	private curryTempChatId = (redis: RedisClient) => {
		function tempChatId(fqueryType: 'set', value: string): Promise<string>
		function tempChatId(queryType: 'get'): Promise<string>
		function tempChatId(queryType: GETSET, value?: string): Promise<string> {
			const kk: { [each in GETSET]: () => Promise<string> } = {
				get: async () =>
					await redis.get(`${this.handledResponse.username}-temp_chat_id`),
				set: async () => await redis.set('', value as string),
			}
			return kk[queryType]()
		}

		return tempChatId
	}

	private curryNickname = (redis: RedisClient) => {
		function tempChatId(fqueryType: 'set', value: string): Promise<string>
		function tempChatId(queryType: 'get'): Promise<string>
		function tempChatId(queryType: GETSET, value?: string): Promise<string> {
			const kk: { [each in GETSET]: () => Promise<string> } = {
				get: async () =>
					await redis.get(`${this.handledResponse.username}-temp_chat_id`),
				set: async () => await redis.set('', value as string),
			}
			return kk[queryType]()
		}

		return tempChatId
	}

	private setTempIntervalTimerList = (intervalTimerList: NodeJS.Timer[]) =>
		intervalTimerList.map((intervalTimer) =>
			this.intervalTimerList.push(intervalTimer),
		)

	private tempChatId = this.curryTempChatId(this.redis)

	// private redisQuery=()=>{

	// }
}
