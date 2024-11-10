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
