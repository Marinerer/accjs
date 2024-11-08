//@ts-nocheck
import fs from 'fs-extra'
import path from 'pathe'
import fg from 'fast-glob'
import { createFileMover, moveFile } from '../src/index'
import { FileMoverError } from '../src/utils'

// Mock fs-extra and path modules
jest.mock('pathe')
jest.mock('fs-extra')
jest.mock('fast-glob')

describe('Move File', () => {
	// Mock implementations
	const mockFs = fs as jest.Mocked<typeof fs>
	const mockPath = path as jest.Mocked<typeof path>
	const mockFg = fg as jest.Mocked<typeof fg>

	beforeEach(() => {
		// 测试前重置所有 mock
		jest.clearAllMocks()
		jest.resetModules()
		// 设置默认的模拟实现
		mockFs.stat.mockResolvedValue({ isDirectory: () => false })
		mockFs.copy.mockResolvedValue(undefined)
		mockFs.remove.mockResolvedValue(undefined)
		mockFs.readdir.mockResolvedValue([])
		mockFs.rmdir.mockResolvedValue(undefined)
		mockPath.resolve.mockImplementation((...args) => args.join('/'))
		mockPath.join.mockImplementation((...args) => args.join('/'))
		mockPath.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/'))
		mockPath.basename.mockImplementation((p) => p.split('/').pop() || '')
		mockPath.extname.mockImplementation((p) => {
			const parts = p.split('.')
			return parts.length > 1 ? `.${parts.pop()}` : ''
		})
	})

	// 基础测试
	describe('Basic Operations', () => {
		it('should move a single file successfully', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			await mover.move({
				'source/file.txt': 'target/file.txt',
			})

			expect(mockFs.copy).toHaveBeenCalledWith(
				'/root/source/file.txt',
				'/root/dest/target/file.txt',
				expect.any(Object)
			)
			expect(mockFs.remove).toHaveBeenCalledWith('/root/source/file.txt')
		})

		it('should move a directory successfully', async () => {
			mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any)

			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			await mover.move({
				'source/dir': 'target/dir',
			})

			expect(mockFs.copy).toHaveBeenCalledWith(
				'/root/source/dir',
				'/root/dest/target/dir',
				expect.any(Object)
			)
		})

		it('should move a glob successfully', async () => {
			mockPath.relative.mockImplementation((p1, p2) => p2.replace(p1, '').replace(/^\//, ''))
			mockFg.mockImplementation((...args) => ['/root/source/file1.txt', '/root/source/file2.txt'])
			const error = new Error('ENOENT') as NodeJS.ErrnoException
			error.code = 'ENOENT'
			mockFs.stat.mockRejectedValueOnce(error)

			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
				base: 'source',
			})

			await mover.move({
				'source/*.txt': 'target',
			})

			expect(mockFg).toHaveBeenCalledWith('source/*.txt', expect.any(Object))
			expect(mockFs.copy).toHaveBeenCalledTimes(2)
			expect(mockFs.copy).toHaveBeenNthCalledWith(
				1,
				'/root/source/file1.txt',
				'/root/dest/target/file1.txt',
				expect.any(Object)
			)
			expect(mockFs.copy).toHaveBeenNthCalledWith(
				2,
				'/root/source/file2.txt',
				'/root/dest/target/file2.txt',
				expect.any(Object)
			)
		})

		it('should respect force option when moving', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
				force: true,
			})

			await mover.move({
				'source/file.txt': 'target/file.txt',
			})

			expect(mockFs.copy).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.objectContaining({
					overwrite: true,
					errorOnExist: false,
				})
			)
		})
	})

	// 测试清理功能
	describe('Cleanup Operations', () => {
		it('should clean empty directories when enabled', async () => {
			const operator = createFileMover({
				cwd: '/root',
				clean: true,
			})

			mockFs.readdir.mockResolvedValue([])

			await operator.move({
				'source/subdir/file1.txt': 'target/file1.txt',
			})

			// 验证是否尝试清理父目录
			expect(mockFs.readdir).toHaveBeenCalledWith('/root/source/subdir')
			expect(mockFs.rmdir).toHaveBeenCalledWith('/root/source/subdir')
			expect(mockFs.readdir).toHaveBeenCalledWith('/root/source')
			expect(mockFs.rmdir).toHaveBeenCalledWith('/root/source')
		})

		it('should not clean non-empty directories', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
				clean: true,
			})

			mockFs.readdir.mockResolvedValue(['some-file'])

			await mover.move({
				'source/dir/file.txt': 'target/file.txt',
			})

			expect(mockFs.rmdir).not.toHaveBeenCalled()
		})
	})

	// 测试错误处理
	describe('Error Handling', () => {
		it('should handle ENOENT error for source path', async () => {
			mockFg.mockResolvedValue((...args) => [])

			const operator = createFileMover({
				cwd: '/test',
				verbose: true,
			})

			const error = new Error('ENOENT') as NodeJS.ErrnoException
			error.code = 'ENOENT'
			mockFs.stat.mockRejectedValueOnce(error)

			// 模拟 console.warn 警告信息
			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

			await operator.move({
				'nonexistent/file.txt': 'target/file.txt',
			})

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('No files found matching pattern')
			)

			consoleSpy.mockRestore()
		})

		it('should throw FileMoverError when copy fails', async () => {
			mockFs.copy.mockRejectedValue(new Error('Copy failed'))

			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			await expect(
				mover.move({
					'source/file.txt': 'target/file.txt',
				})
			).rejects.toThrow(FileMoverError)
		})

		it('should throw FileMoverError when clean fails', async () => {
			mockFs.remove.mockRejectedValue(new Error('Remove failed'))

			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			await expect(
				mover.move({
					'source/file.txt': 'target/file.txt',
				})
			).rejects.toThrow(FileMoverError)
		})
	})

	// 测试事件系统
	describe('Event System', () => {
		it('should emit copy events', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			const copyStartSpy = jest.fn()
			const copyCompleteSpy = jest.fn()

			mover.on('copy:start', copyStartSpy)
			mover.on('copy:complete', copyCompleteSpy)

			await mover.move({
				'source/file.txt': 'target/file.txt',
			})

			expect(copyStartSpy).toHaveBeenCalled()
			expect(copyCompleteSpy).toHaveBeenCalled()
		})

		it('should emit clean events', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			const cleanStartSpy = jest.fn()
			const cleanCompleteSpy = jest.fn()

			mover.on('clean:start', cleanStartSpy)
			mover.on('clean:complete', cleanCompleteSpy)

			await mover.move({
				'source/file.txt': 'target/file.txt',
			})

			expect(cleanStartSpy).toHaveBeenCalled()
			expect(cleanCompleteSpy).toHaveBeenCalled()
		})
	})

	// 测试并发控制
	describe('Concurrency Control', () => {
		test('should respect concurrency limit', async () => {
			const operator = createFileMover({
				cwd: '/test',
				concurrency: 2,
			})

			// 模拟4个文件操作
			const pathMap = {
				'source/file1.txt': 'target/file1.txt',
				'source/file2.txt': 'target/file2.txt',
				'source/file3.txt': 'target/file3.txt',
				'source/file4.txt': 'target/file4.txt',
			}

			const copyOperations: Promise<void>[] = []
			mockFs.copy.mockImplementation(() => {
				const promise = new Promise<void>((resolve) => setTimeout(resolve, 100))
				copyOperations.push(promise)
				return promise
			})

			mockFs.stat.mockResolvedValue({ isDirectory: () => false })
			mockFs.remove.mockResolvedValue(undefined)

			const movePromise = operator.move(pathMap)

			// 等待一小段时间让操作开始
			await new Promise((resolve) => setTimeout(resolve, 50))

			// 检查同时进行的操作数量是否不超过并发限制
			expect(copyOperations.length).toBeLessThanOrEqual(2)

			await movePromise
		})
	})

	//测试路径处理
	describe('Path Handling', () => {
		it('should handle file extensions correctly', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			await mover.move({
				'source/file.txt': 'target',
			})

			expect(mockFs.copy).toHaveBeenCalledWith(
				'/root/source/file.txt',
				'/root/dest/target/file.txt',
				expect.any(Object)
			)
		})

		it('should handle file rename correctly', async () => {
			const mover = createFileMover({
				cwd: '/root',
				dest: 'dest',
			})

			await mover.move({
				'source/file.txt': 'target/doc.txt',
			})

			expect(mockFs.copy).toHaveBeenCalledWith(
				'/root/source/file.txt',
				'/root/dest/target/doc.txt',
				expect.any(Object)
			)
		})

		it('should handle base directory option', async () => {
			const mover = createFileMover({
				cwd: '/root',
				base: 'base',
				dest: 'dest',
			})

			mockPath.resolve.mockImplementation((...args) => args.join('/'))
			mockPath.relative.mockReturnValue('subdir/file.txt')

			await mover.move({
				'base/subdir/file.txt': 'target',
			})

			expect(mockFs.copy).toHaveBeenCalledWith(
				'/root/base/subdir/file.txt',
				'/root/dest/target/subdir/file.txt',
				expect.any(Object)
			)
		})
	})

	describe('moveFile Function', () => {
		it('should work with moveFile function', async () => {
			await moveFile(
				{
					'source/file.txt': 'target/file.txt',
				},
				{
					cwd: '/root',
					dest: 'dest',
				}
			)

			expect(mockFs.copy).toHaveBeenCalled()
			expect(mockFs.remove).toHaveBeenCalled()
		})
	})
})
