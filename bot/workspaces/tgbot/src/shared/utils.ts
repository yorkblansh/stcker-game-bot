import * as E from 'fp-ts/lib/Either'

export interface JsonParseErrorString {
	error: string
}

export const jsonParse = <T>(
	string: string,
): E.Either<JsonParseErrorString, T> => {
	try {
		return E.right(JSON.parse(string))
	} catch (error) {
		E.left({ error })
	}
}
