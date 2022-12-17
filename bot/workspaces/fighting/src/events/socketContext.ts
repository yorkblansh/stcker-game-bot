import { Server, Socket } from 'socket.io'
import { AssembledUser2Event, DamageEventResponse } from './events.gateway'

export interface UserUpdateInfo {
	username: string
	health: number
}

export interface DamagerOpponent {
	damager: UserUpdateInfo
	opponent: UserUpdateInfo
}

export class SocketContext {
	private stuff: AssembledUser2Event

	constructor(private readonly socket: Socket) {}

	getStuff = () => this.stuff
	setStuff = (stuff: AssembledUser2Event) => {
		this.stuff = stuff
		return this
	}

	sendUserUpdate =
		(assembledEvent: string) => (damagerOpponent: DamagerOpponent) => {
			this.socket.emit(`${assembledEvent}_user_update`, damagerOpponent)
		}

	serverContext = (server: Server) => new ServerContext(server)

	setFightStatus = (status: boolean) => this.socket.emit('fight_status', status)

	joinUserRoom = (username: string) => this.socket.join(`room_${username}`)

	listenDamage =
		(assembledEvent: string) => (cb1: (dop: DamageEventResponse) => any) => {
			this.socket.on(
				`${assembledEvent}_damage`,
				(data: DamageEventResponse) => {
					cb1(data)
				},
			)
		}

	// listenEvent = <T>(event: string) => {
	// 	return new Promise<T>((resolve, reject) => {
	// 		this.socket.on(event, (data) => {
	// 			data ? resolve(data) : reject()
	// 		})
	// 	})
	// }
}

class ServerContext {
	constructor(private readonly server: Server) {}

	sendAssembledEvent2User = (username: string, assembledEvent: string) =>
		this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)

	joinRooms2Rooms = (username: string, assembledEvent: string) =>
		this.server.in(`room_${username}`).socketsJoin(assembledEvent)
}
