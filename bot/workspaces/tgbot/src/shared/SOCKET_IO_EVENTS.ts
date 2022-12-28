export const SOCKET_IO_EVENTS = (sharedEvent: string) => ({
	_user_update: `${sharedEvent}_user_update`,
	_ready2fight: `${sharedEvent}_ready2fight`,
	_ready: `${sharedEvent}_ready`,
	_damager_username: `${sharedEvent}_damage`,
	add_user: 'add_user',
})
