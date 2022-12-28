import { Injectable } from '@nestjs/common'
import { Either, left, right } from '@sweet-monads/either'
import { flow, pipe } from 'fp-ts/lib/function'
import chunk from 'lodash.chunk'
import { Server, Socket } from 'socket.io'
import { UserReady2FitghStatus } from '../shared/interfaces'
import { DbService } from '../db/db.service'
import { _ServerContext, UserUpdateInfo } from '../events/_ServerContext'

export interface DamagerOpponent {
	damager: UserUpdateInfo
	opponent: UserUpdateInfo
}

@Injectable()
export class FightingInstanceService {
	private username: string

	constructor(
		private readonly ctx: _ServerContext,
		private readonly db: DbService,
		private readonly socket: Socket,
		private readonly server: Server,
	) {
		this.username = ctx.getUsername()

		this.db.ready2FightUserList.upsertUser(this.username, false)
		this.db.waitingUserList.append(this.username)
		this.db.damageMap.upsertUser(this.username, 1000)
		ctx.joinUserRoom(this.username)

		this.tryNewUser()
	}

	private tryNewUser = () =>
		this.isListMoreThan2()
			.mapRight(() => {
				this.socket.emit('fight_status', true)
				this.assembleUsers2Events(2).map((assembledEvent) => {
					pipe(
						assembledEvent, //
						this.ctx.setStuff,
						this.handleFighting,
					)
				})
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

	private checkReadyStatus = (
		username: string,
		usernameList: string[],
	): UserReady2FitghStatus => {
		this.db.ready2FightUserList.upsertUser(username, true)
		return {
			username,
			areAllUsersReady: usernameList
				.map(this.db.ready2FightUserList.getUserInfo)
				.every((s) => s === true),
		}
	}

	private handleFighting = async (ctx: _ServerContext) => {
		console.log('handle_fighting')
		const assembledEvent = ctx.getStuff()
		const usernameList = assembledEvent.split('.')

		usernameList.map(this.initFightForEachUser(assembledEvent))

		ctx.listenReadyStatus(assembledEvent)((username) => {
			pipe(
				this.checkReadyStatus(username, usernameList),
				firstMessage2Fighters,
				pipe(assembledEvent, ctx.sendUserReady2FightStatus),
			)
		})

		const firstMessage2Fighters = (data: UserReady2FitghStatus) => {
			const { areAllUsersReady } = data
			const dop: DamagerOpponent = {
				damager: { username: usernameList[0], health: 1000 },
				opponent: { username: usernameList[1], health: 1000 },
			}
			areAllUsersReady
				? setTimeout(() => pipe(dop, ctx.sendUserUpdate(assembledEvent)), 2000)
				: console.log({ warning: 'not all users are ready' })
			return data
		}

		ctx.listenDamage(assembledEvent)((damagerUsername) => {
			pipe(
				damagerUsername,
				this.handleDamage(usernameList),
				ctx.sendUserUpdate(assembledEvent),
			)
		})
	}

	private initFightForEachUser =
		(assembledEvent: string) => (username: string) => {
			this.db.damageMap.upsertUser(username, 1000)
			console.log({ assembledEvent, username })
			console.log({ assembled_event_: assembledEvent })
			this.server.of('/').emit(`assembled_event_${username}`, assembledEvent)
			this.server.in(`room_${username}`).socketsJoin(assembledEvent)
			return username
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
