import { pipe } from 'fp-ts/lib/function'
import { io, Socket } from 'socket.io-client'
import { DBFactory } from 'src/bot/utils/dbFactory'
import { FightUserUpdate } from '../bot/bot.service'
import { UserReady2FitghStatus } from '../shared/interfaces'
import { SOCKET_IO_EVENTS } from '../shared/SOCKET_IO_EVENTS'

type CallbackFor<T> = (data: T) => void

export class _ClientContext {
	private db: DBFactory

	setDBInstance = (db: DBFactory) => {
		this.db = db
		return this
	}

	constructor(private readonly socket: Socket) {}

	makeDamage = (username: string) =>
		pipe(username, this.socketEmit('_damager_username'))

	setReadyStatus = (username: string) =>
		pipe(
			username, //
			this.socketEmit('_ready'),
			async (p) => {
				const { _sharedEvent, event } = await p
				console.log({
					DIR: 'setReadyStatus',
					_sharedEvent,
					event,
				})
			},
		)

	listenFightStatus = (cb: CallbackFor<boolean>) =>
		this.socket.on('fight_status', (data) => cb(data))

	addUser = (username: string) =>
		pipe(username, this.socketEmit('add_user'))

	listenSharedEvent = (
		username: string,
		cb: (sharedEvent: string) => void,
	) =>
		this.socket.on(`assembled_event_${username}`, (data) => cb(data))

	listenReadyToFight = (cb: CallbackFor<UserReady2FitghStatus>) =>
		pipe(cb, this.socketOn('_ready2fight'))

	listenUserUpdate = (cb: CallbackFor<FightUserUpdate>) =>
		pipe(cb, this.socketOn('_user_update'))

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
