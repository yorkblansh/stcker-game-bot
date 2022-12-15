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

export class SocketContext {
	constructor(private readonly socket: Socket) {}

	serverContext = (server: Server) => new ServerContext(server)

	setFightStatus = (status: boolean) => this.socket.emit('fight_status', status)

	joinUserRoom = (username: string) => this.socket.join(`room_${username}`)
}

class ServerContext {
	constructor(private readonly server: Server) {}

	sendAssembledEvent2User = (username: string, assembledEvent: string) =>
		this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)

	joinRooms2Rooms = (username: string, assembledEvent: string) =>
		this.server.in(`room_${username}`).socketsJoin(assembledEvent)
}
