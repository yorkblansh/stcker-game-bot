import { Server, Socket } from 'socket.io'
import { SocketIOEvents as se } from '../shared/SocketIOEvents'
import { UserReady2FitghStatus } from '../shared/interfaces'

export interface UserUpdateInfo {
	username: string
	health: number
}

export interface DamagerOpponent {
	damager: UserUpdateInfo
	opponent: UserUpdateInfo
}

export class _ServerContext {
	private sharedEvent: string
	private username: string

	constructor(private readonly socket: Socket) {}

	getSharedEvent = () => this.sharedEvent
	setSharedEvent = (se: string) => {
		this.sharedEvent = se
		return this
	}

	getUsername = () => this.username
	setUsername = (username: string) => {
		this.username = username
		return this
	}

	sendUserUpdate = (damagerOpponent: DamagerOpponent) => {
		this.socket.emit(se._user_update(this.sharedEvent), damagerOpponent)
	}

	sendUserReady2FightStatus =
		(assembledEvent: string) => (data: UserReady2FitghStatus) =>
			this.socket.emit(`${assembledEvent}_ready2fight`, data)

	serverContext = (server: Server) => new ServerContext(server)

	setFightStatus = (status: boolean) => this.socket.emit('fight_status', status)

	joinUserRoom = (username: string) => this.socket.join(`room_${username}`)

	listenReadyStatus = (cb1: (dop: string) => any) => {
		this.socket.on(`${this.sharedEvent}_ready`, (data: string) => cb1(data))
	}

	listenDamage = (cb1: (dop: string) => any) => {
		this.socket.on(`${this.sharedEvent}_damage`, (data: string) => cb1(data))
	}
}

class ServerContext {
	constructor(private readonly server: Server) {}

	sendAssembledEvent2User = (username: string, assembledEvent: string) =>
		this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)

	joinRooms2Rooms = (username: string, assembledEvent: string) =>
		this.server.in(`room_${username}`).socketsJoin(assembledEvent)
}
