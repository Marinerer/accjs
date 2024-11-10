import fs from 'fs-extra'
import path from 'pathe'
import fg from 'fast-glob'
import { EventEmitter } from 'events'
import { PathMapping, MoveOptions } from './types'

// 统一的错误类型
export class FileMoverError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly source?: string,
		public readonly target?: string,
		public readonly originalError?: Error
	) {
		super(message)
		this.name = 'FileMoverError'
	}
}

// 统一的事件类型
export type FileMoverEvent = {
	'copy:start': (source: string, target: string) => void
	'copy:done': (source: string, target: string) => void
	'clean:start': (path: string) => void
	'clean:done': (path: string) => void
	error: (error: FileMoverError) => void
}

// FileMover 类
class FileMover extends EventEmitter {
	private readonly options: Required<MoveOptions>

	constructor(options: MoveOptions = {}) {
		super()
		this.options = {
			cwd: process.cwd(),
			base: '',
			dest: '',
			force: false,
			clean: false,
			verbose: false,
			concurrency: 4,
			...options,
		}
	}

	private _emit<K extends keyof FileMoverEvent>(
		event: K,
		...args: Parameters<FileMoverEvent[K]>
	): boolean {
		return super.emit(event, ...args)
	}

	/**
	 * 复制文件或目录
	 * @param source 源文件路径
	 * @param target 目标路径
	 * @param isDir 源路径是否为目录
	 * @param subPath 附加路径(相对base的路径)
	 */
	private async copyFile(
		source: string,
		target: string,
		isDir: boolean,
		subPath?: string
	): Promise<void> {
		try {
			let finalTarget = target
			const { force } = this.options

			if (isDir) {
				if (subPath) finalTarget = path.join(target, subPath)
			} else {
				// 处理文件扩展名
				const sourceExt = path.extname(source)
				const targetExt = path.extname(target)

				if (!targetExt && sourceExt !== targetExt) {
					finalTarget = subPath
						? path.join(target, subPath)
						: path.join(target, path.basename(source))
				}
			}

			this._emit('copy:start', source, finalTarget)

			await fs.copy(source, finalTarget, {
				overwrite: force,
				errorOnExist: !force,
				preserveTimestamps: true,
			})

			this._emit('copy:done', source, finalTarget)
		} catch (err) {
			throw new FileMoverError(`Failed to copy file`, 'COPY_ERROR', source, target, err as Error)
		}
	}

	/**
	 * 清理空目录
	 * @param {string} dir - 清理目录
	 * @param {string} baseDir - 基准目录
	 */
	private async cleanEmptyDir(dir: string, baseDir: string = ''): Promise<void> {
		try {
			// 不处理基目录之外的目录
			if (!dir.startsWith(baseDir)) return

			const items = await fs.readdir(dir)

			// 如果目录不为空，停止处理
			if (items.length > 0) return

			// 删除空目录
			await fs.rmdir(dir)

			// 递归处理父目录
			const parentDir = path.dirname(dir)
			if (parentDir !== baseDir) {
				await this.cleanEmptyDir(parentDir, baseDir)
			}
		} catch (err) {
			throw new FileMoverError(
				`Failed to clean directory`,
				'CLEAN_ERROR',
				dir,
				undefined,
				err as Error
			)
		}
	}

	/**
	 * 清理文件或目录
	 */
	private async cleanFile(source: string | string[]): Promise<void> {
		const paths = Array.isArray(source) ? source : [source]

		await Promise.all(
			paths.map(async (p) => {
				try {
					this._emit('clean:start', p)

					// 删除源文件
					await fs.remove(p)
					// 清理空目录
					if (this.options.clean) {
						await this.cleanEmptyDir(path.dirname(p), path.resolve(this.options.cwd))
					}

					this._emit('clean:done', p)
				} catch (err) {
					throw new FileMoverError(
						`Failed to clean file`,
						'CLEAN_ERROR',
						p,
						undefined,
						err as Error
					)
				}
			})
		)
	}

	/**
	 * 根据映射表移动文件或目录
	 */
	async move(pathMap: PathMapping): Promise<void> {
		const { cwd, base, dest, concurrency, verbose } = this.options
		const basePath = /\w+/.test(base) ? path.resolve(cwd, base) : null

		// 使用 Promise.all 和 Array.from 来实现并发限制
		const entries = Object.entries(pathMap)
		const chunks = Array.from({ length: Math.ceil(entries.length / concurrency) }, (_, i) =>
			entries.slice(i * concurrency, (i + 1) * concurrency)
		)

		for (const chunk of chunks) {
			await Promise.all(
				chunk.map(async ([source, target]) => {
					// 规范化路径
					const sourcePath = path.resolve(cwd, source)
					const targetPath = path.resolve(cwd, dest, target)
					let subPath = '' // sourcePath相对base的路径

					try {
						// 检查源路径信息
						const sourceStats = await fs.stat(sourcePath)

						if (basePath && sourcePath.startsWith(basePath)) {
							subPath = path.relative(basePath, sourcePath)
						}

						await this.copyFile(sourcePath, targetPath, sourceStats.isDirectory(), subPath)
						await this.cleanFile(sourcePath)
					} catch (err) {
						if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
							// 处理 glob 匹配项
							const files = await fg(source, {
								cwd: cwd,
								absolute: true,
								// onlyFiles: false,
							})

							if (files.length === 0) {
								if (verbose) {
									console.warn(`Warning: No files found matching pattern ${source}`)
								}
								return
							}

							await Promise.all(
								files.map(async (file) => {
									if (basePath && file.startsWith(basePath)) {
										subPath = path.relative(basePath, file)
									}
									await this.copyFile(file, targetPath, true, subPath)
								})
							)

							await this.cleanFile(files)
						} else {
							throw new FileMoverError(
								`Failed to process file`,
								'PROCESS_ERROR',
								sourcePath,
								targetPath,
								err as Error
							)
						}
					}
				})
			)
		}
	}
}

// 导出工厂函数
export function createFileMover(options?: MoveOptions): FileMover {
	return new FileMover(options)
}

// 导出快捷函数
export async function moveFile(pathMap: PathMapping, options: MoveOptions = {}): Promise<void> {
	const mover = new FileMover(options)
	await mover.move(pathMap)
}

export * from './types'
