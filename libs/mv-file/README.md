# Node.js File Move Utility

A robust and flexible utility for moving files and directories with support for glob patterns, concurrent operations, and event handling.

## Features

- 🚀 Promise-based async operations
- 🎯 Glob pattern support
- 📂 Directory structure preservation
- 🔄 Concurrent file operations
- 🎭 Event system for operation monitoring
- ⚡ Performant file operations
- 🛡️ TypeScript support
- 🧹 Optional cleanup of empty directories

## Installation

```bash
npm install file-move-utility
# or
yarn add file-move-utility
```

## Quick Start

```typescript
import { createFileOperator } from 'file-move-utility'

// Create an operator instance
const operator = createFileOperator({
	force: true,
	clean: true,
})

// Move files
await operator.move({
	'src/**/*.ts': 'dist/',
	'assets/images': 'public/images',
})
```

## Using with Events

```typescript
const operator = createFileOperator({
	verbose: true,
})

// Listen to events
operator.on('copy:start', (source, target) => {
	console.log(`Starting copy: ${source} -> ${target}`)
})

operator.on('copy:complete', (source, target) => {
	console.log(`Completed copy: ${source} -> ${target}`)
})

operator.on('error', (error) => {
	console.error('Operation failed:', error.message)
})

// Execute move operation
await operator.move({
	'src/*': 'dist/',
	'public/**/*': 'build/public',
})
```

## API Reference

### `createFileOperator(options?: MoveOptions)`

Creates a new file operator instance with the specified options.

#### Options

```typescript
interface MoveOptions {
	/** Current working directory */
	cwd?: string
	/** Source base directory */
	base?: string
	/** Target base directory */
	dest?: string
	/** Whether to force overwrite existing files */
	force?: boolean
	/** Whether to clean empty directories after move */
	clean?: boolean
	/** Enable verbose logging */
	verbose?: boolean
	/** Maximum number of concurrent operations */
	concurrency?: number
}
```

#### Default Options

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

### `FileOperator Class`

#### Methods

##### `move(pathMap: PathMapping): Promise<void>`

Moves files according to the provided path mapping.

```typescript
interface PathMapping {
	[source: string]: string
}
```

Example:

```typescript
await operator.move({
	'src/**/*.js': 'dist/',
	'assets/images': 'public/images',
	'docs/**/*': 'build/docs',
})
```

#### Events

The FileOperator extends EventEmitter and provides the following events:

| Event            | Parameters                         | Description                             |
| ---------------- | ---------------------------------- | --------------------------------------- |
| `copy:start`     | `(source: string, target: string)` | Emitted when a copy operation starts    |
| `copy:complete`  | `(source: string, target: string)` | Emitted when a copy operation completes |
| `clean:start`    | `(path: string)`                   | Emitted when cleanup starts             |
| `clean:complete` | `(path: string)`                   | Emitted when cleanup completes          |
| `error`          | `(error: FileOperationError)`      | Emitted when an error occurs            |

### Error Handling

The utility uses a custom `FileOperationError` class for error handling:

```typescript
class FileOperationError extends Error {
	code: string
	source?: string
	target?: string
	originalError?: Error
}
```

Example of error handling:

```typescript
operator.on('error', (error) => {
	console.error(`Error during file operation:`)
	console.error(`Code: ${error.code}`)
	console.error(`Source: ${error.source}`)
	console.error(`Target: ${error.target}`)
	console.error(`Message: ${error.message}`)
})
```

## Advanced Usage

### Concurrent Operations

Control the number of concurrent file operations:

```typescript
const operator = createFileOperator({
	concurrency: 8, // Increase concurrent operations
})
```

### Directory Cleaning

Enable automatic cleanup of empty directories:

```typescript
const operator = createFileOperator({
	clean: true,
	verbose: true,
})
```

### Base Directory Configuration

Set up base directories for source and destination:

```typescript
const operator = createFileOperator({
	base: 'src',
	dest: 'dist',
})

await operator.move({
	'**/*.ts': 'typescript/', // Will be relative to base/dest
	'assets/*': 'static/',
})
```

### Progress Monitoring

Implement progress monitoring using events:

```typescript
let totalFiles = 0
let completedFiles = 0

operator.on('copy:start', () => {
	totalFiles++
})

operator.on('copy:complete', () => {
	completedFiles++
	const progress = (completedFiles / totalFiles) * 100
	console.log(`Progress: ${progress.toFixed(2)}%`)
})
```

## Best Practices

1. **Error Handling**

   ```typescript
   try {
   	await operator.move(pathMap)
   } catch (error) {
   	if (error instanceof FileOperationError) {
   		console.error(`Operation failed: ${error.message}`)
   		console.error(`Affected file: ${error.source}`)
   	}
   }
   ```

2. **Resource Management**

   ```typescript
   const operator = createFileOperator({
   	concurrency: 4, // Limit concurrent operations
   	force: false, // Don't overwrite by default
   	verbose: true, // Enable logging in development
   })
   ```

3. **Pattern Usage**
   ```typescript
   await operator.move({
   	// Good patterns
   	'src/**/*.{js,ts}': 'dist/',
   	'public/**/*': 'build/public/',

   	// Avoid overly broad patterns
   	// '**/*': 'dist/',  // Too broad
   })
   ```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
