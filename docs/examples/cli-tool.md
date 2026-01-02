# Building a CLI Tool with Ralph

This example shows how to use Ralph Orchestrator to create a command-line tool with Commander.js, subcommands, and proper packaging.

## Task Description

Create a TypeScript CLI tool for file management with:
- Multiple subcommands
- Progress bars
- Configuration file support
- Error handling
- Installation script

## PROMPT.md File

```markdown
# Task: Build File Manager CLI Tool

Create a TypeScript CLI tool called 'fman' with the following features:

## Commands

1. **list** - List files in directory
   - Options: --all, --size, --date
   - Show file sizes and modification dates

2. **search** - Search for files
   - Options: --name, --extension, --content
   - Support wildcards and regex

3. **copy** - Copy files/directories
   - Show progress bar for large files
   - Options: --recursive, --overwrite

4. **move** - Move files/directories
   - Confirm before overwriting
   - Options: --force

5. **delete** - Delete files/directories
   - Require confirmation
   - Options: --force, --recursive

## Requirements

- Use Commander.js for CLI parsing
- Use chalk for colored output
- Progress bars with cli-progress
- Configuration file support (~/.fmanrc)
- Comprehensive error handling
- Unit tests with Vitest
- Package.json with bin entry

## Project Structure

```
file-manager-cli/
├── src/
│   ├── index.ts         # Entry point
│   ├── cli.ts           # CLI interface
│   ├── commands/        # Command implementations
│   │   ├── index.ts
│   │   ├── list.ts
│   │   ├── search.ts
│   │   ├── copy.ts
│   │   ├── move.ts
│   │   └── delete.ts
│   ├── utils.ts         # Utility functions
│   └── config.ts        # Configuration handling
├── test/
│   └── commands.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

<!-- The orchestrator will continue iterations until all requirements are met -->
```

## Running Ralph

```bash
# Initialize and run
bun run src/index.ts --prompt cli-tool-prompt.md --agent claude --max-iterations 40
```

## Expected Output

### src/cli.ts

```typescript
#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";

import { listCommand } from "./commands/list";
import { searchCommand } from "./commands/search";
import { copyCommand } from "./commands/copy";
import { moveCommand } from "./commands/move";
import { deleteCommand } from "./commands/delete";
import { loadConfig, Config } from "./config";

const program = new Command();

export function createCLI(): Command {
  program
    .name("fman")
    .description("File Manager CLI Tool")
    .version("1.0.0")
    .option("--config <path>", "Config file path", "~/.fmanrc");

  // List command
  program
    .command("list [path]")
    .description("List files in directory")
    .option("-a, --all", "Show hidden files")
    .option("-s, --size", "Sort by size")
    .option("-d, --date", "Sort by date")
    .action(async (path = ".", options) => {
      const config = loadConfig(program.opts().config);
      await listCommand(path, options, config);
    });

  // Search command
  program
    .command("search <pattern>")
    .description("Search for files")
    .option("-p, --path <path>", "Search path", ".")
    .option("-n, --name", "Search in filenames")
    .option("-c, --content", "Search in file contents")
    .option("-e, --extension <ext>", "Filter by extension")
    .action(async (pattern, options) => {
      const config = loadConfig(program.opts().config);
      await searchCommand(pattern, options, config);
    });

  // Copy command
  program
    .command("copy <source> <dest>")
    .description("Copy files or directories")
    .option("-r, --recursive", "Copy recursively")
    .option("-o, --overwrite", "Overwrite existing files")
    .action(async (source, dest, options) => {
      const config = loadConfig(program.opts().config);
      await copyCommand(source, dest, options, config);
    });

  // Move command
  program
    .command("move <source> <dest>")
    .description("Move files or directories")
    .option("-f, --force", "Force move without confirmation")
    .action(async (source, dest, options) => {
      const config = loadConfig(program.opts().config);
      await moveCommand(source, dest, options, config);
    });

  // Delete command
  program
    .command("delete <paths...>")
    .description("Delete files or directories")
    .option("-f, --force", "Force delete without confirmation")
    .option("-r, --recursive", "Delete directories recursively")
    .action(async (paths, options) => {
      const config = loadConfig(program.opts().config);
      await deleteCommand(paths, options, config);
    });

  return program;
}

export async function main(): Promise<void> {
  try {
    const cli = createCLI();
    await cli.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
```

### src/commands/list.ts

```typescript
import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import { Config } from "../config";
import { formatSize, formatDate } from "../utils";

interface ListOptions {
  all?: boolean;
  size?: boolean;
  date?: boolean;
}

interface FileInfo {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: Date;
}

export async function listCommand(
  path: string,
  options: ListOptions,
  config: Config
): Promise<void> {
  const resolvedPath = resolve(path);

  try {
    const stat = statSync(resolvedPath);
    if (!stat.isDirectory()) {
      console.error(chalk.red(`Error: '${path}' is not a directory`));
      return;
    }
  } catch {
    console.error(chalk.red(`Error: Path '${path}' does not exist`));
    return;
  }

  // Get files
  let entries = readdirSync(resolvedPath, { withFileTypes: true });

  // Filter hidden files
  if (!options.all) {
    entries = entries.filter((entry) => !entry.name.startsWith("."));
  }

  // Get file info
  const files: FileInfo[] = entries.map((entry) => {
    const fullPath = join(resolvedPath, entry.name);
    const stats = statSync(fullPath);

    return {
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isSymlink: entry.isSymbolicLink(),
      size: stats.size,
      mtime: stats.mtime,
    };
  });

  // Sort files
  if (options.size) {
    files.sort((a, b) => b.size - a.size);
  } else if (options.date) {
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } else {
    files.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }

  // Print header
  console.log(chalk.bold(`\nFiles in ${resolvedPath}\n`));
  console.log(
    chalk.gray(
      `${"Name".padEnd(40)} ${"Type".padEnd(8)} ${"Size".padStart(12)} ${"Modified".padStart(20)}`
    )
  );
  console.log(chalk.gray("-".repeat(84)));

  // Print files
  for (const file of files) {
    const name = file.isDirectory
      ? chalk.cyan(file.name)
      : file.isSymlink
        ? chalk.magenta(file.name)
        : file.name;

    const type = file.isDirectory
      ? chalk.cyan("DIR")
      : file.isSymlink
        ? chalk.magenta("LINK")
        : chalk.gray("FILE");

    const size = file.isDirectory ? "-".padStart(12) : formatSize(file.size).padStart(12);

    const modified = formatDate(file.mtime).padStart(20);

    console.log(`${name.padEnd(40)} ${type.padEnd(8)} ${chalk.green(size)} ${chalk.yellow(modified)}`);
  }

  console.log(chalk.gray(`\nTotal: ${files.length} items`));
}
```

### src/commands/copy.ts

```typescript
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, resolve, basename } from "path";
import chalk from "chalk";
import { SingleBar, Presets } from "cli-progress";
import { Config } from "../config";
import { confirm, formatSize } from "../utils";

interface CopyOptions {
  recursive?: boolean;
  overwrite?: boolean;
}

async function copyWithProgress(src: string, dst: string): Promise<void> {
  const stats = statSync(src);
  const size = stats.size;

  // For small files, just copy directly
  if (size < 1024 * 1024) {
    copyFileSync(src, dst);
    return;
  }

  // For larger files, show progress bar
  const bar = new SingleBar(
    {
      format: `Copying ${basename(src)} |${chalk.cyan("{bar}")}| {percentage}% | {value}/{total} bytes`,
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    },
    Presets.shades_classic
  );

  bar.start(size, 0);

  // Use Bun's file API for efficient copying with progress
  const srcFile = Bun.file(src);
  const reader = srcFile.stream().getReader();
  const writer = Bun.file(dst).writer();

  let copied = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    writer.write(value);
    copied += value.length;
    bar.update(copied);
  }

  await writer.end();
  bar.stop();
}

function copyDirectory(src: string, dst: string, options: CopyOptions): void {
  mkdirSync(dst, { recursive: true });

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, dstPath, options);
    } else {
      if (existsSync(dstPath) && !options.overwrite) {
        console.log(chalk.yellow(`Skipping ${entry.name} (exists)`));
        continue;
      }
      copyFileSync(srcPath, dstPath);
    }
  }
}

export async function copyCommand(
  source: string,
  dest: string,
  options: CopyOptions,
  config: Config
): Promise<void> {
  const srcPath = resolve(source);
  const dstPath = resolve(dest);

  if (!existsSync(srcPath)) {
    console.error(chalk.red(`Error: Source '${source}' does not exist`));
    return;
  }

  const stats = statSync(srcPath);

  // Handle directory copy
  if (stats.isDirectory()) {
    if (!options.recursive) {
      console.error(chalk.red("Error: Use -r to copy directories"));
      return;
    }

    if (existsSync(dstPath) && !options.overwrite) {
      const shouldOverwrite = await confirm(`'${dest}' exists. Overwrite?`);
      if (!shouldOverwrite) {
        console.log(chalk.yellow("Copy cancelled"));
        return;
      }
    }

    console.log(`Copying directory '${source}' to '${dest}'...`);
    copyDirectory(srcPath, dstPath, options);
    console.log(chalk.green("Directory copied successfully"));
  } else {
    // Handle file copy
    let finalDst = dstPath;

    if (existsSync(dstPath) && statSync(dstPath).isDirectory()) {
      finalDst = join(dstPath, basename(srcPath));
    }

    if (existsSync(finalDst) && !options.overwrite) {
      const shouldOverwrite = await confirm(`'${finalDst}' exists. Overwrite?`);
      if (!shouldOverwrite) {
        console.log(chalk.yellow("Copy cancelled"));
        return;
      }
    }

    // Ensure destination directory exists
    mkdirSync(dirname(finalDst), { recursive: true });

    await copyWithProgress(srcPath, finalDst);
    console.log(chalk.green("File copied successfully"));
  }
}
```

### package.json

```json
{
  "name": "fman",
  "version": "1.0.0",
  "description": "A powerful file manager CLI tool",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "fman": "./dist/cli.js"
  },
  "scripts": {
    "build": "bun build src/cli.ts --outdir dist --target node",
    "dev": "bun run src/cli.ts",
    "test": "bun test",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "cli-progress": "^3.12.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/cli-progress": "^3.11.5",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "cli",
    "file-manager",
    "files",
    "terminal"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

## Testing the CLI

```bash
# Install dependencies
bun install

# Test commands directly
bun run src/cli.ts list --all
bun run src/cli.ts search "*.ts" --path /home/user/projects
bun run src/cli.ts copy file.txt backup.txt
bun run src/cli.ts move old.txt new.txt
bun run src/cli.ts delete temp.txt --force

# Run tests
bun test

# Build for distribution
bun run build
```

## Tips for CLI Development

1. **Clear Command Structure**: Define all commands and options upfront
2. **User Experience**: Request colored output and progress bars
3. **Error Handling**: Specify how errors should be displayed
4. **Configuration**: Include config file support from the start
5. **Testing**: Request unit tests for each command

## Extending the Tool

### Add Compression Support
```markdown
## Additional Command
6. **compress** - Compress files/directories
   - Support zip, tar.gz, tar.bz2
   - Options: --format, --level
   - Show compression ratio
```

### Add Remote Operations
```markdown
## Additional Features
- Support for remote file operations via SSH
- Commands: remote-list, remote-copy, remote-delete
- Use ssh2 for SSH connections
```

## Common Patterns

### Confirmation Prompts
```typescript
import * as readline from "readline";

export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`${message} [y/N]: `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}
```

### Error Handling
```typescript
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R | undefined> {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("EACCES")) {
          console.error(chalk.red("Permission denied"));
        } else if (error.message.includes("ENOENT")) {
          console.error(chalk.red("File not found"));
        } else {
          console.error(chalk.red(`Error: ${error.message}`));
        }
      }
      return undefined;
    }
  };
}
```

## Cost Estimation

- **Iterations**: ~30-40 for full implementation
- **Time**: ~15-20 minutes
- **Agent**: Claude or Gemini
- **API Calls**: ~$0.30-0.40
