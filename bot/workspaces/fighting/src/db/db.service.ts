import { Injectable } from '@nestjs/common'

@Injectable()
export class DbService {
	private _waitingUserList: string[]
	private _damageMap: Map<string, number>

	constructor() {
		this._waitingUserList = []
		this._damageMap = new Map()
	}

	waitingUserList = {
		append: (...items: string[]) => this._waitingUserList.push(...items),
		__CLEAR__: () => (this._waitingUserList = []),
		getList: () => this._waitingUserList,
	}

	damageMap = {
		upsertUser: (username: string, health: number) =>
			this._damageMap.set(username, health),
		getUserInfo: (username: string) => this._damageMap.get(username),
	}
}
