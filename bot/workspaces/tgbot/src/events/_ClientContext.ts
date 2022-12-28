import { pipe } from 'fp-ts/lib/function'
import { io, Socket } from 'socket.io-client'
import { FightUserUpdate } from '../bot/bot.service'
import { UserReady2FitghStatus } from '../shared/interfaces'
import { SOCKET_IO_EVENTS } from '../shared/SOCKET_IO_EVENTS'

type CallbackFor<T> = (data: T) => void

export class _ClientContext {
	private sharedEvent

	setSharedEvent = (sharedEvent: string) => {
		this.sharedEvent = sharedEvent
		return this
	}
	getSharedEvent = () => this.sharedEvent

	private socket: Socket

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

	listenFightStatus = (cb: (fightStatus: boolean) => void) =>
		this.socket.on('fight_status', (data) => cb(data))

	addUser = (username: string) =>
		this.socket.emit(SOCKET_IO_EVENTS().add_user, username)

	listenSharedEvent = (
		username: string,
		cb: (sharedEvent: string) => void,
	) =>
		this.socket.on(`assembled_event_${username}`, (data) => cb(data))

	listenReadyToFight = (
		cb: (data: UserReady2FitghStatus) => void,
	) => {
		this.socket.on(
			SOCKET_IO_EVENTS(this.sharedEvent)._ready2fight,
			(data) => cb(data),
		)
	}

	listenUserUpdate = (cb: CallbackFor<FightUserUpdate>) =>
		pipe(
			SOCKET_IO_EVENTS(this.sharedEvent)._ready2fight,
			this.socketOn(cb),
		)

	// const event = SOCKET_IO_EVENTS(this.sharedEvent)._ready2fight
	// this.socket.on(event, (data) => cb(data))

	// this.socket.on(
	// 	SOCKET_IO_EVENTS(this.sharedEvent)._ready2fight,
	// 	(data) => cb(data),
	// )

	private socketOn =
		(cb: (data: unknown) => void) => (event: string) => {
			this.socket.on(event, (data) => cb(data))
		}
}
