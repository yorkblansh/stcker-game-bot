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
import { SocketContext, UserUpdateInfo } from './socketContext'
import md5 from 'md5'
import { pipe } from 'fp-ts/lib/function'

const { App } = pks
export type RedisClient = ReturnType<typeof createClient>

const app = App()

export interface DamageEventResponse {
	damagerUsername: string
}

export interface AssembledUser2Event {
	assembledEvent: string
	user0: string
	user1: string
}

export interface DamagerOpponent {
	damager: UserUpdateInfo
	opponent: UserUpdateInfo
}

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

	private assembleUsers2Events = (): AssembledUser2Event[] => {
		return chunk(this.waitingUserList, 2).map((userPair) => {
			const user0 = userPair[0]
			const user1 = userPair[1]
			const assembledEvent = user0 + '.' + user1
			return { assembledEvent, user0, user1 }
		})
	}

	private getRandomDamage = (min: number, max: number) => 10

	private isListMoreThan2 = (): Either<boolean, boolean> =>
		this.waitingUserList.length >= 2 ? right(true) : left(false)

	private handleFighting = async (
		ctx: SocketContext,
		socket: Socket,
		data: AssembledUser2Event,
	) => {
		const { assembledEvent, user0, user1 } = data
		console.log('handle_fighting')
		console.log({ user0, user1 })
		;[user0, user1].map((username, index) => {
			this.damageMap.set(username, 100)
			console.log({ assembledEvent, username })
			const servCtx = ctx.serverContext(this.server)
			console.log({ assembled_event_: assembledEvent })
			this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)
			this.server.in(`room_${username}`).socketsJoin(assembledEvent)

			// servCtx.joinRooms2Rooms(username, assembledEvent)
			// servCtx.sendAssembledEvent2User(username, assembledEvent)
		})

		// const { damagerUsername } = await ctx.listenDamageEvent(assembledEvent)

		ctx.listenDamage(assembledEvent)((damageEventResponse) => {
			pipe(
				damageEventResponse,
				this.handleDamage(data),
				ctx.sendUserUpdate(assembledEvent),
			)
		})

		// const damagerOpponent = this.handleDamage(data)(a)
		// ctx.sendUserUpdate(assembledEvent)(damagerOpponent)

		// pipe(
		// 	this.handleDamage(data),
		// 	ctx.listenDamage(assembledEvent),
		// 	async (p) => {
		// 		const damagerOpponent = await pdamagerOpponent
		// 		ctx.sendUserUpdate(assembledEvent, damagerOpponent)
		// 	},
		// )

		// socket.on(`${assembledEvent}_damage`)
	}

	@SubscribeMessage('add_user')
	addUser(@MessageBody() username: string, @ConnectedSocket() socket: Socket) {
		const ctx = new SocketContext(socket)
		this.waitingUserList.push(username)
		this.damageMap.set(username, 100)
		ctx.joinUserRoom(username)
		// socket.join(`room_${username}`)

		this.isListMoreThan2()
			.mapRight(() => {
				socket.emit('fight_status', true)
				const assembleUser2EventsList = this.assembleUsers2Events()
				console.log({ length: assembleUser2EventsList.length })
				assembleUser2EventsList.map((data) => {
					this.handleFighting(ctx, socket, data)
				})
			})
			.mapLeft(() => {
				socket.emit('fight_status', false)
				console.log('not enought client')
			})
	}

	private handleDamage =
		(data: AssembledUser2Event) =>
		({ damagerUsername }: DamageEventResponse): DamagerOpponent => {
			const { assembledEvent, user0, user1 } = data
			console.log({ damagerUsername })
			const randomDamage = this.getRandomDamage(10, 10)

			const opponentUserName = user0 === damagerUsername ? user1 : user0 // нужна более сторгая проверка username
			const userName = user0 === damagerUsername ? user0 : user1

			const prevOpponentHealth = this.damageMap.get(opponentUserName)
			this.damageMap.set(opponentUserName, prevOpponentHealth - randomDamage)

			const userHealth = this.damageMap.get(userName)

			const damagerOpponent = {
				damager: {
					username: userName,
					health: userHealth,
				},
				opponent: {
					username: opponentUserName,
					health: prevOpponentHealth - randomDamage,
				},
			}

			console.log({ damagerOpponent })

			return damagerOpponent
			// ctx.sendUserUpdate(assembledEvent, damagerOpponent)
			// socket.emit(`${assembledEvent}_user_update`, damagerOpponent)
		}
}
