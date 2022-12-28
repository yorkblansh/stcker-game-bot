export const SOCKET_IO_EVENTS = (sharedEvent: string) => ({
	_user_update: `${sharedEvent}_user_update`,
	_ready2fight: `${sharedEvent}_ready2fight`,
})
