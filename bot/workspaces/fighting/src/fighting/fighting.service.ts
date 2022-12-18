import { Injectable } from '@nestjs/common'
import { Either, left, right } from '@sweet-monads/either'
import { pipe } from 'fp-ts/lib/function'
import chunk from 'lodash.chunk'
import { Server, Socket } from 'socket.io'
import { DbService } from '../db/db.service'
import { SocketContext, UserUpdateInfo } from '../events/socketContext'

export interface DamagerOpponent {
	damager: UserUpdateInfo
	opponent: UserUpdateInfo
}

@Injectable()
export class FightingInstanceService {
	private username: string

	constructor(
		private readonly ctx: SocketContext,
		private readonly db: DbService,
		private readonly socket: Socket,
		private readonly server: Server,
	) {
		this.username = ctx.getUsername()

		this.db.waitingUserList.append(this.username)
		this.db.damageMap.upsertUser(this.username, 100)
		ctx.joinUserRoom(this.username)

		this.tryNewUser()
	}

	private tryNewUser = () =>
		this.isListMoreThan2()
			.mapRight(() => {
				this.socket.emit('fight_status', true)
				this.assembleUsers2Events(2).map(this.ctx.setStuff)
				this.handleFighting(this.ctx)
			})
			.mapLeft(() => {
				this.socket.emit('fight_status', false)
				console.log('not enought client')
			})

	private assembleUsers2Events = (chunkSize: number): string[] =>
		chunk(this.db.waitingUserList.getList(), chunkSize) //
			.map((userPair) =>
				userPair //
					.reduce((prev, current) => prev + '.' + current),
			)

	private isListMoreThan2 = (): Either<boolean, boolean> => {
		const jj = this.db.waitingUserList.getList()
		console.log({ jj })
		return jj.length >= 2 ? right(true) : left(false)
	}

	private handleFighting = async (ctx: SocketContext) => {
		console.log('handle_fighting')
		const assembledEvent = ctx.getStuff()
		const usernameList = assembledEvent.split('.')
		usernameList.map(this.initFightForEachUser(assembledEvent))
		ctx.listenDamage(assembledEvent)((damageEventResponse) => {
			pipe(
				damageEventResponse,
				this.handleDamage(usernameList),
				ctx.sendUserUpdate(assembledEvent),
			)
		})
	}

	private initFightForEachUser =
		(assembledEvent: string) => (username: string) => {
			this.db.damageMap.upsertUser(username, 100)
			console.log({ assembledEvent, username })
			console.log({ assembled_event_: assembledEvent })
			this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)
			this.server.in(`room_${username}`).socketsJoin(assembledEvent)
		}

	private handleDamage =
		(usernameList: string[]) =>
		(damagerUsername: string): DamagerOpponent => {
			console.log({ damagerUsername })
			const randomDamage = this.getRandomDamage(10, 10)

			const { userName, opponentUserName } =
				this.mapDamagerAndOpponentUsernames(usernameList, damagerUsername)
			const prevOpponentHealth = this.db.damageMap.getUserInfo(opponentUserName)
			const updatedDamageForOpponent = prevOpponentHealth - randomDamage
			this.db.damageMap.upsertUser(opponentUserName, updatedDamageForOpponent)
			const userHealth = this.db.damageMap.getUserInfo(userName)

			const damagerOpponent = {
				damager: {
					username: userName,
					health: userHealth,
				},
				opponent: {
					username: opponentUserName,
					health: updatedDamageForOpponent,
				},
			}
			console.log({ damagerOpponent })
			return damagerOpponent
		}

	private mapDamagerAndOpponentUsernames = (
		usernameList: string[],
		damagerUsername: string,
	) => ({
		opponentUserName:
			usernameList[0] === damagerUsername ? usernameList[1] : usernameList[0],
		userName:
			usernameList[0] === damagerUsername ? usernameList[0] : usernameList[1],
	})

	private getRandomDamage = (min: number, max: number) => 10
}
