import { sync as symlinkOrCopySync } from 'symlink-or-copy'

export class Symlink {
	private symlinkList: string[][]

	constructor() {
		this.symlinkList = []
	}

	symlinkFolder = (srcPath: string, destPath: string) => {
		this.symlinkList.push([srcPath, destPath])
		return this
	}

	buildSymlinks = () => this.symlinkList.map(this._symlinkOrCopySync)

	private _symlinkOrCopySync = ([srcPath, destPath]: string[]) => {
		try {
			symlinkOrCopySync(srcPath, destPath)
		} catch (error) {
			const ERROR = {
				srcPath,
				destPath,
				error,
			}
			console.log(ERROR)
		}
	}
}
