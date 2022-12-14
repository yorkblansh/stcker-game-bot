import TelegramBot from 'node-telegram-bot-api'
import {
	InlineKeyboard,
	Row,
	InlineKeyboardButton,
} from 'node-telegram-keyboard-wrapper'

export enum FightMode {
	generic = 'fight_mode',
	damage = 'fight_mode.damage',
	// no = 'fight_mode.no',
}

export const fightModeKDB = () => {
	const keyboard = new InlineKeyboard()
	keyboard.push(
		/**
		 * Forcing generic type here due to InlineKeyboardButton generic.
		 * See Row's file for a better Typescript explanation
		 */
		new Row<InlineKeyboardButton>(
			new InlineKeyboardButton(
				'🗡НАНЕСТИ УРОН🗡',
				'callback_data',
				FightMode.damage,
			),
		),
	)

	const options: TelegramBot.SendMessageOptions = {
		reply_markup: keyboard.getMarkup(),
	}

	const editMessageOptions: TelegramBot.EditMessageTextOptions = {
		reply_markup: keyboard.getMarkup(),
	}
	return { options, keyboard, editMessageOptions }
}
