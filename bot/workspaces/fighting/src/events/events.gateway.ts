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

	constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClient) {}

	onModuleInit() {
		this.damageMap = new Map()
		this.waitingUserList = []

		console.log('module init')

		this.server.on('connection', (socket) => {
			console.log('new connect')
		})
	}

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
				assembleUser2EventsList.map(({ assembledEvent, user0, user1 }) => {
					console.log({ user0, user1 })
					;[user0, user1].map((username) => {
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
				})
			})
			.mapLeft(() => {
				client.emit('fight_status', false)
				console.log('not enought client')
			})
	}
}
