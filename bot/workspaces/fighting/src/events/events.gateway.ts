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

	private assembleUsers2Events = (chunkSize: number): string[] => {
		return chunk(this.waitingUserList, chunkSize).map((userPair) => {
			return userPair.reduce((prev, current) => prev + '.' + current)
			// const user0 = userPair[0]
			// const user1 = userPair[1]
			// const assembledEvent = user0 + '.' + user1
			// return { assembledEvent, user0, user1 }
		})
	}

	private getRandomDamage = (min: number, max: number) => 10

	private isListMoreThan2 = (): Either<boolean, boolean> =>
		this.waitingUserList.length >= 2 ? right(true) : left(false)

	private handleFighting = async (
		ctx: SocketContext,
		// socket: Socket,
		// data: AssembledUser2Event,
	) => {
		const assembledEvent = ctx.getStuff()
		const usernameList = assembledEvent.split('.')
		// const { assembledEvent, user0, user1 } = data
		console.log('handle_fighting')
		usernameList.map(this.initFightForEachUser(assembledEvent))

		ctx.listenDamage(assembledEvent)((damageEventResponse) => {
			pipe(
				damageEventResponse,
				this.handleDamage(usernameList),
				ctx.sendUserUpdate(assembledEvent),
			)
		})
	}

	private initFightForEachUser =
		(assembledEvent: string) => (username: string) => {
			this.damageMap.set(username, 100)
			console.log({ assembledEvent, username })
			console.log({ assembled_event_: assembledEvent })
			this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)
			this.server.in(`room_${username}`).socketsJoin(assembledEvent)
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
				this.assembleUsers2Events(2).map((event) => {
					ctx.setStuff(event)
					this.handleFighting(ctx)
				})
			})
			.mapLeft(() => {
				socket.emit('fight_status', false)
				console.log('not enought client')
			})
	}

	private mapDamagerOpponent = (
		usernameList: string[],
		damagerUsername: string,
	) => ({
		opponentUserName:
			usernameList[0] === damagerUsername ? usernameList[1] : usernameList[0],
		userName:
			usernameList[0] === damagerUsername ? usernameList[0] : usernameList[1],
	})

	private handleDamage =
		(usernameList: string[]) =>
		({ damagerUsername }: DamageEventResponse): DamagerOpponent => {
			// const { assembledEvent, user0, user1 } = data
			console.log({ damagerUsername })
			const randomDamage = this.getRandomDamage(10, 10)

			const { userName, opponentUserName } = this.mapDamagerOpponent(
				usernameList,
				damagerUsername,
			)
			const prevOpponentHealth = this.damageMap.get(opponentUserName)
			const updatedDamageForOpponent = prevOpponentHealth - randomDamage
			this.damageMap.set(opponentUserName, updatedDamageForOpponent)
			const userHealth = this.damageMap.get(userName)

			const damagerOpponent = {
				damager: {
					username: userName,
					health: userHealth,
				},
				opponent: {
					username: opponentUserName,
					health: updatedDamageForOpponent,
				},
			}
			console.log({ damagerOpponent })
			return damagerOpponent
		}
}
