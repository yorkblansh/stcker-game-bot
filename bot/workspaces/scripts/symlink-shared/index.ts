import { Symlink } from './symlink.service'

export const runSymlink = () => {
	const symlink = new Symlink()
	symlink
		.symlinkFolder('../tgbot/src/shared', '../fighting/src/shared')
		.buildSymlinks()
}

runSymlink()
