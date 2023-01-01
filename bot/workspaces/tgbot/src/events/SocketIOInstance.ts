import { io, Socket } from 'socket.io-client'

export class SocketIOInstance {
	public socket: Socket

	constructor() {
		this.socket = io('http://localhost:4040/')

		// client-side
		this.socket.on('connect', () => {
			console.log(this.socket.id) // x8WIv7-mJelg7on_ALbx
		})

		this.socket.on('disconnect', () => {
			console.log(this.socket.id) // undefined
		})
	}
}
