import chalk from 'chalk'

const error_color = chalk.bold.red
const warning_color = chalk.hex('#fbff00').bold
const blue_color = chalk.hex('#00eeff')
const green_color = chalk.hex('#00ff15').bold

export class ColorConsole {
	WARN = (text: string) => console.log(warning_color(text))
	ERROR = (text: string) => console.log(error_color(text))
	INFO = (text: string) => console.log(blue_color(text))
	SUCCES = (text: string) => console.log(green_color(text))
}
