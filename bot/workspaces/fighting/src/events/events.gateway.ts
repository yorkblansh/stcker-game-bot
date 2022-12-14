import { Inject, OnModuleInit } from '@nestjs/common'
// import { JwtService } from "@nestjs/jwt"
import {
	ConnectedSocket,
	MessageBody,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets'
import pks from 'uWebSockets.js'

// import { wsAuthGuard } from "auth/guards/ws-auth.guard"
// import { ParsedData, ParserError } from "common/types/parser.types"
// import { ParserService } from "parser/parser.service"
import { createClient } from 'redis'
import { Server, Socket } from 'socket.io'
import chunk from 'lodash.chunk'
import { Either, left, right } from '@sweet-monads/either'
const { App } = pks
export type RedisClient = ReturnType<typeof createClient>

const app = App()

@WebSocketGateway(4040, {
	cors: {
		origin: '*',
		// maxAge: 5000,
		// preflightContinue: false,
	},

	// connectTimeout: 10000,
	// destroyUpgradeTimeout: 12000,
	// pingTimeout: 2000,
	// upgradeTimeout: 1000,
})
export class EventsGateway implements OnModuleInit {
	@WebSocketServer()
	server: Server

	private damageMap: Map<string, number>

	private waitingUserList: string[] = []
	// private io: Server

	constructor(
		// private readonly parser: ParserService,
		// private readonly jwtService: JwtService,
		@Inject('REDIS_CLIENT') private readonly redis: RedisClient,
	) {
		// this.emitParsed()
		// this.server.on('test', () => {
		// 	console.log('handle test')
		// })
	}

	onModuleInit() {
		this.damageMap = new Map()
		this.waitingUserList = []

		console.log('module init')

		this.server.on('connection', (socket) => {
			console.log('new connect')
		})
		// const io = new Server(3033, { allowEIO3: true, cors: { origin: '*' } })

		// // this.io.attachApp(app)

		// io.on('connection', (socket) => {
		// 	socket.on('test', (data) => {
		// 		console.log({ data })
		// 	})

		// 	console.log('new connect')
		// })

		// io.listen(3034)
		// this.initBot(process.env.BOT_KEY)
		// this.handleCommands()
	}

	// async emitParsed() {
	// 	const either = await this.parser.getData()

	// 	const handleParserError = (parserError: ParserError) => {
	// 		console.log(parserError.error)
	// 	}

	// 	const handleSendingToClient = async (parsedData: ParsedData) => {
	// 		const parsing_state = (await this.redis.get('parsing_state')) as '0' | '1'

	// 		if (parsing_state === '1') {
	// 			this.server.to('parsing_room').emit('parse', {
	// 				parsedData,
	// 				...{ timstamp: new Date().getMilliseconds() },
	// 			})
	// 		}

	// 		this.server.to('parsing_room').emit('parse_state', {
	// 			state: parsing_state,
	// 		})
	// 	}

	// 	setInterval(() => {
	// 		either.mapRight(handleSendingToClient).mapLeft(handleParserError)
	// 	}, 500)
	// }

	private assembleUsers2Events = () => {
		return chunk(this.waitingUserList, 2).map((userPair) => {
			const user0 = userPair[0]
			const user1 = userPair[1]
			const assembledEvent = user0 + '.' + user1
			return { assembledEvent, user0, user1 }
		})
	}

	private isListMoreThan2 = (): Either<boolean, boolean> =>
		this.waitingUserList.length >= 2 ? right(true) : left(false)

	@SubscribeMessage('add_user')
	addUser(@MessageBody() username: string, @ConnectedSocket() client: Socket) {
		this.waitingUserList.push(username)
		this.damageMap.set(username, 100)
		client.join(`room_${username}`)

		this.isListMoreThan2()
			.mapRight(() => {
				client.emit('fight_status', true)
				const assembleUser2EventsList = this.assembleUsers2Events()
				console.log({ length: assembleUser2EventsList.length })
				assembleUser2EventsList.map(
					({ assembledEvent, user0, user1 }, index) => {
						console.log({ user0, user1 })
						;[user0, user1].map((username, index) => {
							this.damageMap.set(username, 100)
							console.log({ assembledEvent, username })
							this.server.in(`room_${username}`).socketsJoin(assembledEvent)

							this.server
								.of('/')
								.emit(`assembled_event_${username}`, assembledEvent)
						})

						client.on(
							`${assembledEvent}_damage`,
							(data: { damagerUsername: string }) => {
								console.log({ data })
								const randomDamage = 10

								const opponentUserName =
									user0 === data.damagerUsername ? user1 : user0 // нужна более сторгая проверка username
								const userName = user0 === data.damagerUsername ? user0 : user1

								const prevOpponentHealth = this.damageMap.get(opponentUserName)
								this.damageMap.set(
									opponentUserName,
									prevOpponentHealth - randomDamage,
								)

								const userHealth = this.damageMap.get(userName)

								client.emit(`${assembledEvent}_user_update`, {
									damager: {
										username: userName,
										health: userHealth,
									},
									opponent: {
										username: opponentUserName,
										health: prevOpponentHealth - randomDamage,
									},
								})
							},
						)
					},
				)
			})
			.mapLeft(() => {
				client.emit('fight_status', false)
				console.log('not enought client')
			})

		// this.server.socketsLeave('parsing_room')
		// this.server.socketsJoin('parsing_room')
	}
}
