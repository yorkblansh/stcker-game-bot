import TelegramBot from 'node-telegram-bot-api'
import {
	InlineKeyboard,
	Row,
	InlineKeyboardButton,
} from 'node-telegram-keyboard-wrapper'

export enum LocationSwitch {
	generic = 'location_switch',
	right = 'location_switch.right',
	left = 'location_switch.left',
	middle = 'location_switch.middle',
	arena = 'location_switch.arena',
	shop = 'location_switch.shop',
}

interface Props {
	middleButton: string
}

export const locationKBD = ({ middleButton }: Props) => {
	const keyboard = new InlineKeyboard()
	keyboard.push(
		/**
		 * Forcing generic type here due to InlineKeyboardButton generic.
		 * See Row's file for a better Typescript explanation
		 */

		new Row<InlineKeyboardButton>(
			new InlineKeyboardButton(
				'АРЕНА 🏟',
				'callback_data',
				LocationSwitch.arena,
			),
			new InlineKeyboardButton(
				'Магазин 🏪',
				'callback_data',
				LocationSwitch.shop,
			),
		),
		new Row<InlineKeyboardButton>(
			new InlineKeyboardButton(
				'⏪',
				'callback_data',
				LocationSwitch.left,
			),
			new InlineKeyboardButton(
				middleButton,
				'callback_data',
				LocationSwitch.middle,
			),
			new InlineKeyboardButton(
				'⏩',
				'callback_data',
				LocationSwitch.right,
			),
		),
	)

	const options: TelegramBot.SendMessageOptions = {
		reply_markup: keyboard.getMarkup(),
	}
	return { options, keyboard }
}
