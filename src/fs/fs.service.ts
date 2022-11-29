import { Injectable } from '@nestjs/common'
import fs from 'fs'
import path from 'path'
import { pipe } from 'fp-ts/lib/function'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

@Injectable()
export class FsService {
	getHelloImg = () =>
		pipe(
			this.carryPathJoin('../src/assets/imgs/sticker_fights.jpg'),
			fs.createReadStream,
		)

	private carryPathJoin = (relativePath: string) =>
		path.join(__dirname, relativePath)
}
