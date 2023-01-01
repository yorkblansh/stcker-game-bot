import { pipe } from 'fp-ts/lib/function'
import { io, Socket } from 'socket.io-client'
import { DBFactory } from 'src/bot/utils/dbFactory'
import { UserContext } from 'src/bot/utils/userContext'
import { FightUserUpdate } from '../bot/bot.service'
import { UserReady2FitghStatus } from '../shared/interfaces'
import { SOCKET_IO_EVENTS } from '../shared/SOCKET_IO_EVENTS'

type CallbackFor<T> = (data: T) => void

export class _ClientContext {
	private sharedEvent: string
	private db: DBFactory
	private username: string

	// setSharedEvent = (sharedEvent: string) => {
	// 	console.log({ DIR: 'setSharedEvent', sharedEvent })
	// 	this.sharedEvent = sharedEvent
	// 	return this
	// }

	// getSharedEvent = () => this.sharedEvent

	setDBInstance = (db: DBFactory, username: string) => {
		this.db = db
		this.username = username
	}
	// private socket: Socket

	constructor(private readonly socket: Socket) {
		// this.sharedEventCollection = new Map()
		// this.socket = io('http://localhost:4040/')
		// // client-side
		// this.socket.on('connect', () => {
		// 	console.log(this.socket.id) // x8WIv7-mJelg7on_ALbx
		// })
		// this.socket.on('disconnect', () => {
		// 	console.log(this.socket.id) // undefined
		// })
	}

	makeDamage = (username: string) =>
		pipe(username, this.socketEmit('_damager_username'))

	setReadyStatus = (username: string) =>
		pipe(username, this.socketEmit('_ready'), async (p) => {
			const { _sharedEvent, event } = await p
			console.log({
				DIR: 'setReadyStatus',
				_sharedEvent,
				event,
			})
		})

	listenFightStatus = (cb: CallbackFor<boolean>) =>
		this.socket.on('fight_status', (data) => cb(data))

	addUser = (username: string) =>
		pipe(username, this.socketEmit('add_user'))
	// this.socket.emit(SOCKET_IO_EVENTS().add_user, username)

	listenSharedEvent = (
		username: string,
		cb: (sharedEvent: string) => void,
	) =>
		this.socket.on(`assembled_event_${username}`, (data) => cb(data))

	listenReadyToFight = (cb: CallbackFor<UserReady2FitghStatus>) =>
		pipe(cb, this.socketOn('_ready2fight'))

	listenUserUpdate = (cb: CallbackFor<FightUserUpdate>) =>
		pipe(cb, this.socketOn('_user_update'))

	// this.socket.on(this.le('_user_update'), cb)

	// pipe(this.le('_user_update'), this.socketOn(cb))

	// const event = SOCKET_IO_EVENTS(this.sharedEvent)._ready2fight
	// this.socket.on(event, (data) => cb(data))

	// this.socket.on(
	// 	SOCKET_IO_EVENTS(this.sharedEvent)._ready2fight,
	// 	(data) => cb(data),
	// )

	// /**
	//  * get listening event
	//  */
	// private le = (event: keyof ReturnType<typeof SOCKET_IO_EVENTS>) =>
	// 	SOCKET_IO_EVENTS(this.sharedEvent)[event]

	private socketOn =
		(event: keyof ReturnType<typeof SOCKET_IO_EVENTS>) =>
		async (cb: (data: unknown) => void) => {
			const sharedEvent = await this.db.assembledEvent('get')
			this.socket.on(SOCKET_IO_EVENTS(sharedEvent)[event], (data) =>
				cb(data),
			)
		}

	private socketEmit =
		(event: keyof ReturnType<typeof SOCKET_IO_EVENTS>) =>
		async (data: unknown) => {
			const sharedEvent = await this.db.assembledEvent('get')
			this.socket.emit(SOCKET_IO_EVENTS(sharedEvent)[event], data)

			return {
				_sharedEvent: sharedEvent,
				event,
			}
		}
}
