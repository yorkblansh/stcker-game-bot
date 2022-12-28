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
import { _ServerContext, UserUpdateInfo } from './ServerSocketContext'
import md5 from 'md5'
import { pipe } from 'fp-ts/lib/function'
import { FightingInstanceService } from '../fighting/fighting.service'
import { DbService } from '../db/db.service'

const { App } = pks
export type RedisClient = ReturnType<typeof createClient>

const app = App()

// export interface DamageEventResponse {
// 	damagerUsername: string
// }

export interface AssembledUser2Event {
	assembledEvent: string
	user0: string
	user1: string
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

	db: DbService

	constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClient) {}

	onModuleInit() {
		console.log('module init')

		this.server.on('connection', (socket) => {
			console.log('new connect')
		})

		this.db = new DbService()
	}

	@SubscribeMessage('add_user')
	addUser(@MessageBody() username: string, @ConnectedSocket() socket: Socket) {
		const ctx = new _ServerContext(socket).setUsername(username)

		new FightingInstanceService(ctx, this.db, socket, this.server)
	}
}
