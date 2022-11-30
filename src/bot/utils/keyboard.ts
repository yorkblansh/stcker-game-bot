import {
	InlineKeyboard,
	Row,
	InlineKeyboardButton,
} from 'node-telegram-keyboard-wrapper'

enum NameConfirmation {
	yes = 'yes',
	no = 'no',
}

export const isItYourName = () =>
	new InlineKeyboard().push(
		/**
		 * Forcing generic type here due to InlineKeyboardButton generic.
		 * See Row's file for a better Typescript explanation
		 */
		new Row<InlineKeyboardButton>(
			new InlineKeyboardButton('Да', 'callback_data', NameConfirmation.yes),
			new InlineKeyboardButton('Нет', 'callback_data', NameConfirmation.no),
		),
	)
