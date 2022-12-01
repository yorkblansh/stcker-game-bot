import TelegramBot from 'node-telegram-bot-api'
import {
	InlineKeyboard,
	Row,
	InlineKeyboardButton,
} from 'node-telegram-keyboard-wrapper'

export enum NameConfirmation {
	generic = 'name_confirmation',
	yes = 'name_confirmation.yes',
	no = 'name_confirmation.no',
}

export const isItYourName = () => {
	const keyboard = new InlineKeyboard()
	keyboard.push(
		/**
		 * Forcing generic type here due to InlineKeyboardButton generic.
		 * See Row's file for a better Typescript explanation
		 */
		new Row<InlineKeyboardButton>(
			new InlineKeyboardButton('Да', 'callback_data', NameConfirmation.yes),
			new InlineKeyboardButton('Нет', 'callback_data', NameConfirmation.no),
		),
	)

	const options: TelegramBot.SendMessageOptions = {
		reply_markup: keyboard.getMarkup(),
	}
	return { options, keyboard }
}
