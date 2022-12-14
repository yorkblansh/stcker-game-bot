import { Server, Socket } from 'socket.io'

interface UserUpdateInfo {
	damager: {
		username: string
		health: number
	}
	opponent: {
		username: string
		health: number
	}
}

interface DamageEventResponse {
	damagerUsername: string
}

export class SocketContext {
	constructor(private readonly socket: Socket) {}

	serverContext = (server: Server) => new ServerContext(server)

	sendUserUpdate = (uui: UserUpdateInfo) => (assembledEvent: string) =>
		this.socket.emit(`${assembledEvent}_user_update`, uui)

	setFightStatus = (status: boolean) => this.socket.emit('fight_status', status)

	joinUserRoom = (username: string) => this.socket.join(`room_${username}`)

	listenDamageEvent = (
		assembledEvent: string,
	): Promise<DamageEventResponse> => {
		return new Promise((resolve, reject) =>
			this.socket.on(
				`${assembledEvent}_damage`,
				(data: DamageEventResponse) => {
					resolve(data)
				},
			),
		)
	}
}

class ServerContext {
	constructor(private readonly server: Server) {}

	sendAssembledEvent2User = (username: string, assembledEvent: string) =>
		this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)

	joinRooms2Rooms = (username: string, assembledEvent: string) =>
		this.server.in(`room_${username}`).socketsJoin(assembledEvent)
}
