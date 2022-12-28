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
	private stuff: string
	private username: string

	constructor(private readonly socket: Socket) {}

	getStuff = () => this.stuff
	setStuff = (stuff: string) => {
		this.stuff = stuff
		return this
	}

	getUsername = () => this.username
	setUsername = (username: string) => {
		this.username = username
		return this
	}

	sendUserUpdate =
		(assembledEvent: string) => (damagerOpponent: DamagerOpponent) => {
			this.socket.emit(se._user_update(assembledEvent), damagerOpponent)
		}

	sendUserReady2FightStatus =
		(assembledEvent: string) => (data: UserReady2FitghStatus) =>
			this.socket.emit(`${assembledEvent}_ready2fight`, data)

	serverContext = (server: Server) => new ServerContext(server)

	setFightStatus = (status: boolean) => this.socket.emit('fight_status', status)

	joinUserRoom = (username: string) => this.socket.join(`room_${username}`)

	listenReadyStatus =
		(assembledEvent: string) => (cb1: (dop: string) => any) => {
			this.socket.on(`${assembledEvent}_ready`, (data: string) => cb1(data))
		}

	listenDamage = (assembledEvent: string) => (cb1: (dop: string) => any) => {
		this.socket.on(`${assembledEvent}_damage`, (data: string) => cb1(data))
	}
}

class ServerContext {
	constructor(private readonly server: Server) {}

	sendAssembledEvent2User = (username: string, assembledEvent: string) =>
		this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)

	joinRooms2Rooms = (username: string, assembledEvent: string) =>
		this.server.in(`room_${username}`).socketsJoin(assembledEvent)
}