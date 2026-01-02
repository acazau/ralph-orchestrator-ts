# Simple Task Example: Todo List CLI

This example demonstrates building a simple command-line todo list application using Ralph Orchestrator.

## Overview

We'll create a TypeScript CLI application that:
- Manages todo items (add, list, complete, remove)
- Persists data to JSON file
- Includes colored output
- Has comprehensive error handling

## The Prompt

Create a file `todo-prompt.md`:

```markdown
# Build Todo List CLI Application

## Objective
Create a command-line todo list manager with file persistence.

## Requirements

### Core Features
1. Add new todo items with descriptions
2. List all todos with status
3. Mark todos as complete
4. Remove todos
5. Clear all todos
6. Save todos to JSON file

### Technical Specifications
- Language: TypeScript with Bun runtime
- File storage: todos.json
- Use Commander.js for CLI
- Add colored output (use chalk or picocolors)
- Include proper error handling

### Commands
- `todo add <description>` - Add new todo
- `todo list` - Show all todos
- `todo done <id>` - Mark as complete
- `todo remove <id>` - Delete todo
- `todo clear` - Remove all todos

### File Structure
```
todo-app/
├── src/
│   └── todo.ts      # Main CLI application
├── todos.json       # Data storage
├── test/
│   └── todo.test.ts # Unit tests
├── package.json
└── README.md        # Documentation
```

## Example Usage

```bash
$ bun run src/todo.ts add "Buy groceries"
Added: Buy groceries (ID: 1)

$ bun run src/todo.ts add "Write documentation"
Added: Write documentation (ID: 2)

$ bun run src/todo.ts list
Todo List:
[ ] 1. Buy groceries
[ ] 2. Write documentation

$ bun run src/todo.ts done 1
Completed: Buy groceries

$ bun run src/todo.ts list
Todo List:
[x] 1. Buy groceries
[ ] 2. Write documentation

$ bun run src/todo.ts remove 1
Removed: Buy groceries
```

## Data Format

todos.json:
```json
{
  "todos": [
    {
      "id": 1,
      "description": "Buy groceries",
      "completed": false,
      "createdAt": "2024-01-10T10:00:00",
      "completedAt": null
    }
  ],
  "nextId": 2
}
```

## Success Criteria
- [ ] All commands working as specified
- [ ] Data persists between runs
- [ ] Colored output for better UX
- [ ] Error handling for edge cases
- [ ] Tests cover main functionality
- [ ] README with usage instructions

The orchestrator will continue iterations until all criteria are met or limits reached.
```

## Running the Example

### Basic Execution

```bash
bun run src/index.ts --prompt todo-prompt.md
```

### With Specific Settings

```bash
# Budget-conscious approach
bun run src/index.ts \
  --agent q \
  --prompt todo-prompt.md \
  --max-cost 2.0 \
  --max-iterations 20

# Quality-focused approach
bun run src/index.ts \
  --agent claude \
  --prompt todo-prompt.md \
  --max-cost 10.0 \
  --checkpoint-interval 3
```

## Expected Results

### Iterations

Typical completion: 5-15 iterations

### Cost Estimates

- **Q Chat**: $0.50 - $1.50
- **Gemini**: $0.75 - $2.00
- **Claude**: $2.00 - $5.00

### Files Created

After successful completion:

```
todo-app/
├── src/
│   └── todo.ts      # ~200 lines
├── todos.json       # Initial empty structure
├── test/
│   └── todo.test.ts # ~100 lines
├── package.json
└── README.md        # ~50 lines
```

## Sample Output

Here's what the generated `src/todo.ts` might look like:

```typescript
#!/usr/bin/env bun
/**
 * Todo List CLI Application
 * A simple command-line todo manager with JSON persistence.
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "fs";
import chalk from "chalk";

// Types
interface Todo {
  id: number;
  description: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface TodoStore {
  todos: Todo[];
  nextId: number;
}

class TodoManager {
  private filename: string;
  private store: TodoStore;

  constructor(filename = "todos.json") {
    this.filename = filename;
    this.store = this.loadTodos();
  }

  private loadTodos(): TodoStore {
    if (!existsSync(this.filename)) {
      return { todos: [], nextId: 1 };
    }

    try {
      const data = readFileSync(this.filename, "utf-8");
      return JSON.parse(data);
    } catch {
      return { todos: [], nextId: 1 };
    }
  }

  private saveTodos(): void {
    writeFileSync(this.filename, JSON.stringify(this.store, null, 2));
  }

  addTodo(description: string): number {
    const todo: Todo = {
      id: this.store.nextId,
      description,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    this.store.todos.push(todo);
    this.store.nextId += 1;
    this.saveTodos();

    console.log(chalk.green(`Added: ${description} (ID: ${todo.id})`));
    return todo.id;
  }

  listTodos(): void {
    if (this.store.todos.length === 0) {
      console.log(chalk.yellow("No todos found."));
      return;
    }

    console.log(chalk.bold("Todo List:"));
    for (const todo of this.store.todos) {
      const status = todo.completed
        ? chalk.green("[x]")
        : chalk.gray("[ ]");
      console.log(`${status} ${todo.id}. ${todo.description}`);
    }
  }

  completeTodo(todoId: number): boolean {
    const todo = this.store.todos.find((t) => t.id === todoId);

    if (!todo) {
      console.log(chalk.red(`Todo with ID ${todoId} not found.`));
      return false;
    }

    todo.completed = true;
    todo.completedAt = new Date().toISOString();
    this.saveTodos();
    console.log(chalk.green(`Completed: ${todo.description}`));
    return true;
  }

  removeTodo(todoId: number): boolean {
    const index = this.store.todos.findIndex((t) => t.id === todoId);

    if (index === -1) {
      console.log(chalk.red(`Todo with ID ${todoId} not found.`));
      return false;
    }

    const [removed] = this.store.todos.splice(index, 1);
    this.saveTodos();
    console.log(chalk.green(`Removed: ${removed.description}`));
    return true;
  }

  clearTodos(): void {
    const count = this.store.todos.length;
    this.store = { todos: [], nextId: 1 };
    this.saveTodos();
    console.log(chalk.green(`Cleared ${count} todos.`));
  }
}

// CLI Setup
const program = new Command();
const manager = new TodoManager();

program
  .name("todo")
  .description("Todo List CLI")
  .version("1.0.0");

program
  .command("add <description...>")
  .description("Add a new todo")
  .action((description: string[]) => {
    manager.addTodo(description.join(" "));
  });

program
  .command("list")
  .description("List all todos")
  .action(() => {
    manager.listTodos();
  });

program
  .command("done <id>")
  .description("Mark todo as complete")
  .action((id: string) => {
    manager.completeTodo(parseInt(id, 10));
  });

program
  .command("remove <id>")
  .description("Remove a todo")
  .action((id: string) => {
    manager.removeTodo(parseInt(id, 10));
  });

program
  .command("clear")
  .description("Clear all todos")
  .action(() => {
    manager.clearTodos();
  });

program.parse();
```

## Variations

### 1. Enhanced Version

Add these features to the prompt:

```markdown
## Additional Features
- Priority levels (high, medium, low)
- Due dates with reminders
- Categories/tags
- Search functionality
- Export to CSV/Markdown
```

### 2. Web Interface

Transform to a web application:

```markdown
## Web Version
Instead of CLI, create a Hono web app with:
- HTML interface
- REST API endpoints
- SQLite database
- Basic authentication
```

### 3. Collaborative Version

Add multi-user support:

```markdown
## Multi-User Features
- User accounts
- Shared todo lists
- Permissions (view/edit)
- Activity logging
```

## Troubleshooting

### Issue: File Not Created

**Solution**: Ensure the agent has write permissions:

```bash
# Check permissions
ls -la

# Run with explicit path
bun run src/index.ts --prompt ./todo-prompt.md
```

### Issue: Tests Failing

**Solution**: Specify test framework:

```markdown
## Testing Requirements
Use Vitest for testing:
- Install: bun add -d vitest
- Run: bun test
- Coverage: bun test --coverage
```

### Issue: Colors Not Working

**Solution**: Add fallback for environments without color support:

```markdown
## Color Output
- Try chalk first (cross-platform)
- Fall back to plain text
- Detect terminal support
- Add --no-color option
```

## Learning Points

### What This Example Teaches

1. **CLI Development**: Using Commander.js effectively
2. **Data Persistence**: JSON file handling in TypeScript
3. **Error Handling**: Graceful failure modes
4. **User Experience**: Colored output and clear feedback
5. **Testing**: Writing unit tests for CLI apps with Vitest

### Key Patterns

- Command pattern for CLI actions
- Repository pattern for data storage
- Clear separation of concerns
- Comprehensive error messages

## Next Steps

After completing this example:

1. **Extend Features**: Add the variations mentioned above
2. **Improve Testing**: Add integration tests
3. **Package It**: Create a proper npm package
4. **Add CI/CD**: GitHub Actions workflow

## Related Examples

- [Web API Example](web-api.md) - Build a REST API version
- [CLI Tool Example](cli-tool.md) - More advanced CLI patterns
- [Data Analysis Example](data-analysis.md) - Process todo statistics

---

Continue to [Web API Example](web-api.md) →
