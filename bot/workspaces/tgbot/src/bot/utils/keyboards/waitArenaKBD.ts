import TelegramBot from 'node-telegram-bot-api'
import {
	InlineKeyboard,
	Row,
	InlineKeyboardButton,
} from 'node-telegram-keyboard-wrapper'

export enum WaitArena {
	generic = 'wait_arena',
	back = 'wait_arena.back',
	fight = 'wait_arena.fight',
	test = 'wait_arena.test',
}

export const waitArenaKBD = () => {
	const keyboard = new InlineKeyboard()
	keyboard.push(
		/**
		 * Forcing generic type here due to InlineKeyboardButton generic.
		 * See Row's file for a better Typescript explanation
		 */
		new Row<InlineKeyboardButton>(
			new InlineKeyboardButton('◀️', 'callback_data', WaitArena.back),
			new InlineKeyboardButton('⚔️', 'callback_data', WaitArena.fight),
			new InlineKeyboardButton('🟦', 'callback_data', WaitArena.test),

		),
	)

	const options: TelegramBot.SendMessageOptions = {
		reply_markup: keyboard.getMarkup(),
	}
	return { options, keyboard }
}
