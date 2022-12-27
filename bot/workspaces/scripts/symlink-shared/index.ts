/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
import { sync as symlinkOrCopySync } from 'symlink-or-copy'
import chalk from 'chalk'

export const runSymlink = () => {
	const error_color = chalk.bold.red
	const warning_color = chalk.hex('#fbff00').bold
	const blue_color = chalk.hex('#00eeff')
	const green_color = chalk.hex('#00ff15').bold

	const WARN = (text: string) => console.log(warning_color(text))
	const ERROR = (text: string) => console.log(error_color(text))
	const INFO = (text: string) => console.log(blue_color(text))
	const SUCCES = (text: string) => console.log(green_color(text))

	try {
		symlinkOrCopySync('../../tgbot/src/shared', '../../fighting/src/shared')
	} catch (error) {
		console.log({ error })
	}
}

runSymlink()
