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

export interface PathMapping {
	[key: string]: string
}

export interface MoveOptions {
	/**
	 * current working directory
	 *
	 * 当前工作目录
	 * @default process.cwd()
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
	 * @default false
	 */
	force?: boolean
	/**
	 * whether to clean empty directories
	 *
	 * 是否清理空目录
	 * @default false
	 */
	clean?: boolean
	/**
	 * whether to print verbose logs
	 *
	 * 是否启用详细日志
	 * @default false
	 */
	verbose?: boolean
	/**
	 * concurrency count
	 *
	 * 并发最大数
	 * @default 4
	 */
	concurrency?: number
}
