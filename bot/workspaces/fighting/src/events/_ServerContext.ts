import { Server, Socket } from 'socket.io'
import { SOCKET_IO_EVENTS as __SOCKET_IO_EVENTS__ } from '../shared/SocketIOEvents'
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
	private SOCKET_IO_EVENTS: ReturnType<typeof __SOCKET_IO_EVENTS__>

	constructor(private readonly socket: Socket) {}

	getSharedEvent = () => this.sharedEvent
	setSharedEvent = (se: string) => {
		this.sharedEvent = se
		this.SOCKET_IO_EVENTS = __SOCKET_IO_EVENTS__(se)
		return this
	}

	getUsername = () => this.username
	setUsername = (username: string) => {
		this.username = username
		return this
	}

	sendUserUpdate = (damagerOpponent: DamagerOpponent) => {
		this.socket.emit(
			this.SOCKET_IO_EVENTS._user_update,
			damagerOpponent,
		)
	}

	sendUserReady2FightStatus = (data: UserReady2FitghStatus) =>
		this.socket.emit(`${this.sharedEvent}_ready2fight`, data)

	serverContext = (server: Server) => new ServerContext(server)

	setFightStatus = (status: boolean) =>
		this.socket.emit('fight_status', status)

	joinUserRoom = (username: string) =>
		this.socket.join(`room_${username}`)

	listenReadyUserStatus = (cb: (username: string) => void) => {
		this.socket.on(`${this.sharedEvent}_ready`, (username: string) =>
			cb(username),
		)
	}

	listenDamagerUsername = (cb: (username: string) => void) => {
		this.socket.on(`${this.sharedEvent}_damage`, (username: string) =>
			cb(username),
		)
	}
}

class ServerContext {
	constructor(private readonly server: Server) {}

	sendAssembledEvent2User = (
		username: string,
		assembledEvent: string,
	) =>
		this.server
			.of('/')
			.emit(`assembled_event_${username}`, assembledEvent)

	joinRooms2Rooms = (username: string, assembledEvent: string) =>
		this.server.in(`room_${username}`).socketsJoin(assembledEvent)
}
