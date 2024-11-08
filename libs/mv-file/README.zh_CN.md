# Node.js 文件移动工具

一个功能强大且灵活的文件和目录移动工具，支持 glob 模式匹配、并发操作和事件处理。

## 特性

- 🚀 基于 Promise 的异步操作
- 🎯 支持 Glob 模式匹配
- 📂 保持目录结构
- 🔄 并发文件操作
- 🎭 操作监控事件系统
- ⚡ 高性能文件操作
- 🛡️ TypeScript 支持
- 🧹 可选的空目录清理

## 安装

```bash
npm install file-move-utility
# 或
yarn add file-move-utility
```

## 快速开始

```typescript
import { createFileOperator } from 'file-move-utility'

// 创建操作实例
const operator = createFileOperator({
	force: true, // 强制覆盖已存在的文件
	clean: true, // 清理空目录
})

// 移动文件
await operator.move({
	'src/**/*.ts': 'dist/',
	'assets/images': 'public/images',
})
```

## 使用事件监听

```typescript
const operator = createFileOperator({
	verbose: true, // 启用详细日志
})

// 监听事件
operator.on('copy:start', (source, target) => {
	console.log(`开始复制: ${source} -> ${target}`)
})

operator.on('copy:complete', (source, target) => {
	console.log(`复制完成: ${source} -> ${target}`)
})

operator.on('error', (error) => {
	console.error('操作失败:', error.message)
})

// 执行移动操作
await operator.move({
	'src/*': 'dist/',
	'public/**/*': 'build/public',
})
```

## API 文档

### `createFileOperator(options?: MoveOptions)`

创建一个新的文件操作实例。

#### 配置选项

```typescript
interface MoveOptions {
	/** 当前工作目录 */
	cwd?: string
	/** 源基础目录 */
	base?: string
	/** 目标基础目录 */
	dest?: string
	/** 是否强制覆盖已存在的文件 */
	force?: boolean
	/** 是否清理空目录 */
	clean?: boolean
	/** 启用详细日志 */
	verbose?: boolean
	/** 最大并发操作数 */
	concurrency?: number
}
```

#### 默认配置

```typescript
{
  cwd: process.cwd(),
  base: '',
  dest: '',
  force: false,
  clean: false,
  verbose: false,
  concurrency: 4
}
```

### `FileOperator 类`

#### 方法

##### `move(pathMap: PathMapping): Promise<void>`

根据提供的路径映射移动文件。

```typescript
interface PathMapping {
	[source: string]: string
}
```

示例：

```typescript
await operator.move({
	'src/**/*.js': 'dist/',
	'assets/images': 'public/images',
	'docs/**/*': 'build/docs',
})
```

#### 事件

FileOperator 继承自 EventEmitter，提供以下事件：

| 事件             | 参数                               | 说明               |
| ---------------- | ---------------------------------- | ------------------ |
| `copy:start`     | `(source: string, target: string)` | 开始复制文件时触发 |
| `copy:complete`  | `(source: string, target: string)` | 完成文件复制时触发 |
| `clean:start`    | `(path: string)`                   | 开始清理时触发     |
| `clean:complete` | `(path: string)`                   | 完成清理时触发     |
| `error`          | `(error: FileOperationError)`      | 发生错误时触发     |

### 错误处理

工具使用自定义的 `FileOperationError` 类进行错误处理：

```typescript
class FileOperationError extends Error {
	code: string
	source?: string
	target?: string
	originalError?: Error
}
```

错误处理示例：

```typescript
operator.on('error', (error) => {
	console.error(`文件操作错误：`)
	console.error(`错误代码：${error.code}`)
	console.error(`源路径：${error.source}`)
	console.error(`目标路径：${error.target}`)
	console.error(`错误信息：${error.message}`)
})
```

## 高级用法

### 并发操作控制

控制同时进行的文件操作数量：

```typescript
const operator = createFileOperator({
	concurrency: 8, // 增加并发操作数
})
```

### 目录清理

启用自动清理空目录：

```typescript
const operator = createFileOperator({
	clean: true,
	verbose: true,
})
```

### 基础目录配置

设置源文件和目标文件的基础目录：

```typescript
const operator = createFileOperator({
	base: 'src',
	dest: 'dist',
})

await operator.move({
	'**/*.ts': 'typescript/', // 相对于 base/dest 目录
	'assets/*': 'static/',
})
```

### 进度监控

使用事件实现进度监控：

```typescript
let totalFiles = 0
let completedFiles = 0

operator.on('copy:start', () => {
	totalFiles++
})

operator.on('copy:complete', () => {
	completedFiles++
	const progress = (completedFiles / totalFiles) * 100
	console.log(`进度：${progress.toFixed(2)}%`)
})
```

## 最佳实践

1. **错误处理**

   ```typescript
   try {
   	await operator.move(pathMap)
   } catch (error) {
   	if (error instanceof FileOperationError) {
   		console.error(`操作失败：${error.message}`)
   		console.error(`受影响的文件：${error.source}`)
   	}
   }
   ```

2. **资源管理**

   ```typescript
   const operator = createFileOperator({
   	concurrency: 4, // 限制并发操作数
   	force: false, // 默认不覆盖文件
   	verbose: true, // 开发环境启用日志
   })
   ```

3. **模式匹配使用**

   ```typescript
   await operator.move({
   	// 推荐的模式
   	'src/**/*.{js,ts}': 'dist/',
   	'public/**/*': 'build/public/',

   	// 避免过于宽泛的模式
   	// '**/*': 'dist/',  // 范围太大
   })
   ```

## 常见问题

**Q: 如何处理大量文件移动时的性能问题？**
A: 通过调整 `concurrency` 参数来平衡性能和系统资源使用：

```typescript
const operator = createFileOperator({
	concurrency: 8, // 根据系统性能调整
	verbose: true, // 监控操作过程
})
```

**Q: 如何确保不会意外覆盖重要文件？**
A: 默认情况下工具不会覆盖文件，需要显式启用：

```typescript
const operator = createFileOperator({
	force: false, // 默认值，遇到同名文件会报错
})
```

**Q: 如何处理移动失败的文件？**
A: 使用错误处理和事件监听来跟踪失败的操作：

```typescript
const failedFiles = []

operator.on('error', (error) => {
	failedFiles.push({
		source: error.source,
		reason: error.message,
	})
})
```

## 许可证

MIT

## 贡献

欢迎提交 Pull Request 来改进这个工具！

## 更新日志

### 1.0.0

- 初始版本发布
- 支持基本的文件移动功能
- 添加事件系统
- 支持并发控制

### 1.1.0

- 添加空目录清理功能
- 改进错误处理机制
- 增加详细日志选项
