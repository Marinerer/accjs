import minimist from 'minimist'
import { execa } from 'execa'
import { getPackage } from './utils.mjs'

const args = minimist(process.argv.slice(2))
const libs = args._
// console.log('args : ', args)

;(async () => {
	const pkgs = await getPackage(libs)
	const libNames = pkgs.map((v) => v.name)
	for (const name of libNames) {
		await execa({ stdout: 'inherit', stderr: 'inherit' })`pnpm -F ${name} run build`
	}
})()
