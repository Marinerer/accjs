import fs from 'fs-extra'
import path from 'pathe'
import fg from 'fast-glob'

type PathMapping = { [key: string]: string }

interface MoveOptions {
	/**
	 * current working directory
	 *
	 * 当前工作目录
	 */
	cwd?: string
	/**
	 * source base directory
	 *
	 * 源基础目录
	 */
	base?: string
	/**
	 * target base directory
	 *
	 * 目标基础目录
	 */
	dest?: string
	/**
	 * whether to force overwrite
	 *
	 * 是否强制覆盖
	 */
	force?: boolean
	/**
	 * whether to clean empty directories
	 *
	 * 是否清理空目录
	 */
	clean?: boolean
}

interface CopyOptions {
	/** 强制覆盖 */
	force?: boolean
	/** 源路径是否为目录 */
	dir?: boolean
	/** 附加路径(相对base的路径) */
	subPath?: string
}

/**
 * 复制文件或目录
 * @param {string} source - 源文件路径
 * @param {string} target - 目标路径
 * @param {Object} options - 配置项
 */
async function copyFile(source: string, target: string, options: CopyOptions = {}): Promise<void> {
	const { force = false, dir, subPath } = options
	try {
		let finalTarget = target
		if (dir) {
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

		await fs.copy(source, finalTarget, {
			overwrite: force,
			errorOnExist: !force,
			preserveTimestamps: true,
		})
	} catch (err) {
		throw new Error(
			`Failed to copy ${source} to ${target}: ${(<NodeJS.ErrnoException>err).message}`
		)
	}
}

/**
 * 清理空目录
 * @param {string} dir - 清理目录
 * @param {string} baseDir - 基准目录
 */
async function cleanEmptyDir(dir: string, baseDir: string = '') {
	try {
		// 不处理基目录之外的目录
		if (!dir.startsWith(baseDir)) {
			return
		}

		const items = await fs.readdir(dir)

		// 如果目录不为空，停止处理
		if (items.length > 0) {
			return
		}

		// 删除空目录
		await fs.rmdir(dir)

		// 递归处理父目录
		const parentDir = path.dirname(dir)
		if (parentDir !== baseDir) {
			await cleanEmptyDir(parentDir, baseDir)
		}
	} catch (err) {
		console.warn(`Warning: Failed to clean ${dir}: ${(<NodeJS.ErrnoException>err).message}`)
	}
}

/**
 * 清理文件或目录
 * @param {string|string[]} source - 源文件/目录路径
 * @param {Object} options - 配置项
 * @param {string} options.baseDir - 基准目录
 * @param {boolean} options.clean - 清理空目录
 */
async function cleanFile(
	source: string | string[],
	options: { baseDir?: string; clean?: boolean } = {}
): Promise<void> {
	const { baseDir, clean } = options
	const paths = Array.isArray(source) ? source : [source]

	await Promise.all(
		paths.map(async (p) => {
			try {
				// 删除源文件/目录
				await fs.remove(p)

				// 清理空目录
				if (clean) {
					await cleanEmptyDir(path.dirname(p), baseDir)
				}
			} catch (err) {
				console.warn(`Warning: Failed to clean ${p}: ${(<NodeJS.ErrnoException>err).message}`)
			}
		})
	)
}

/**
 * Moves files according to the mapping
 *
 * 根据映射表移动文件或目录
 * @param {PathMapping} pathMap - File path mapping { source: target }
 * @param {IOptions} options - Move options
 */
async function moveFile(pathMap: PathMapping, options: MoveOptions = {}): Promise<void> {
	const { cwd = process.cwd(), base = '', dest = '', force = false, clean = false } = options
	// 规范化基础路径
	const rootDir = path.resolve(cwd)
	const basePath = /\w+/.test(base) ? path.resolve(cwd, base) : null

	// 并行处理文件/目录
	const tasks = Object.entries(pathMap).map(async ([source, target]) => {
		const sourcePath = path.resolve(cwd, source)
		const targetPath = path.resolve(cwd, dest, target)
		// sourcePath相对base的路径
		let subPath = ''

		try {
			// 检查源是否存在并确定类型
			const sourceStats = await fs.stat(sourcePath)

			if (basePath && sourcePath.startsWith(basePath)) {
				subPath = path.relative(basePath, sourcePath)
			}

			// 根据类型复制文件
			await copyFile(sourcePath, targetPath, {
				force,
				dir: sourceStats.isDirectory(),
				subPath,
			})

			// 清理源文件
			await cleanFile(sourcePath, { baseDir: rootDir, clean })
		} catch (err) {
			if ((<NodeJS.ErrnoException>err).code === 'ENOENT') {
				// 处理 glob 匹配项
				const files = await fg(source, {
					cwd,
					absolute: true,
					// onlyFiles: false,
				})

				if (files.length === 0) {
					console.warn(`Warning: No files found matching pattern ${source}`)
					return
				}

				await Promise.all(
					files.map(async (file) => {
						if (basePath && file.startsWith(basePath)) {
							subPath = path.relative(basePath, file)
						}
						await copyFile(file, targetPath, {
							force,
							dir: true,
							subPath,
						})
					})
				)

				await cleanFile(files, { baseDir: rootDir, clean })
			} else {
				throw new Error(`Failed to process ${sourcePath}: ${(<NodeJS.ErrnoException>err).message}`)
			}
		}
	})

	try {
		await Promise.all(tasks)
	} catch (err) {
		throw new Error(`File moving failed: ${(<NodeJS.ErrnoException>err).message}`)
	}
}

export { moveFile }
