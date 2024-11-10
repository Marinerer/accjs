import { execa } from 'execa'
import minimist from 'minimist'
import { modulesMap, toArgs } from './utils.mjs'

const args = minimist(process.argv.slice(2))
const modules = args._

;(async () => {
	let regex
	const _args = toArgs(args, 'array')

	try {
		if (modules?.length) {
			const _mods = modules.map((name) => modulesMap[name]).join('|')
			regex = `(${_mods})/.*\\.(test|spec)\\.[jt]s$`
		}

		const jestArgs = ['--env', 'node', '--runInBand', ..._args]
		if (regex) jestArgs.push(regex)
		await execa('jest', jestArgs, {
			stdout: 'inherit',
			stderr: 'inherit',
		})
	} catch (err) {
		console.error(`Tests failed for ${regex}`)
		process.exit(1)
	}
})()
