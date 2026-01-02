# Building a Web API with Ralph

This example demonstrates how to use Ralph Orchestrator to build a complete REST API with database integration.

## Task Description

Create a Hono REST API for a todo list application with:
- SQLite database
- CRUD operations
- Input validation
- Error handling
- Unit tests

## PROMPT.md File

```markdown
# Task: Build Todo List REST API

Create a Hono REST API with the following requirements:

## API Endpoints

1. GET /todos - List all todos
2. GET /todos/:id - Get single todo
3. POST /todos - Create new todo
4. PUT /todos/:id - Update todo
5. DELETE /todos/:id - Delete todo

## Data Model

Todo:
- id (integer, primary key)
- title (string, required, max 200 chars)
- description (text, optional)
- completed (boolean, default false)
- createdAt (datetime)
- updatedAt (datetime)

## Requirements

- Use Hono framework
- Use Drizzle ORM with SQLite
- Input validation with Zod
- Proper HTTP status codes
- Error handling with JSON responses
- Unit tests with Vitest
- README with API documentation

## File Structure

```
todo-api/
├── src/
│   ├── index.ts       # Main application
│   ├── db/
│   │   ├── schema.ts  # Database models
│   │   └── index.ts   # Database connection
│   ├── routes/
│   │   └── todos.ts   # Todo routes
│   └── schemas/
│       └── todos.ts   # Validation schemas
├── test/
│   └── api.test.ts    # Unit tests
├── package.json
├── drizzle.config.ts
└── README.md          # Documentation
```

<!-- The orchestrator will continue iterations until all requirements are met -->
```

## Running Ralph

```bash
# Initialize project
bun run src/index.ts --prompt web-api-prompt.md --agent claude --max-iterations 50
```

## Expected Output

Ralph will create the following files:

### src/index.ts

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { todoRoutes } from "./routes/todos";
import { db } from "./db";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Routes
app.route("/todos", todoRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Error handling
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Start server
const port = process.env.PORT || 3000;
console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};

export { app };
```

### src/db/schema.ts

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
```

### src/db/index.ts

```typescript
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const sqlite = new Database("todos.db");

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
`);

export const db = drizzle(sqlite, { schema });
```

### src/schemas/todos.ts

```typescript
import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  completed: z.boolean().optional().default(false),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
```

### src/routes/todos.ts

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { todos, type Todo } from "../db/schema";
import { createTodoSchema, updateTodoSchema } from "../schemas/todos";

const app = new Hono();

// GET /todos - List all todos
app.get("/", async (c) => {
  const allTodos = await db.select().from(todos);
  return c.json(allTodos);
});

// GET /todos/:id - Get single todo
app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const [todo] = await db.select().from(todos).where(eq(todos.id, id));

  if (!todo) {
    return c.json({ error: "Todo not found" }, 404);
  }

  return c.json(todo);
});

// POST /todos - Create new todo
app.post("/", zValidator("json", createTodoSchema), async (c) => {
  const data = c.req.valid("json");

  const [todo] = await db
    .insert(todos)
    .values({
      title: data.title,
      description: data.description,
      completed: data.completed,
    })
    .returning();

  return c.json(todo, 201);
});

// PUT /todos/:id - Update todo
app.put("/:id", zValidator("json", updateTodoSchema), async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const data = c.req.valid("json");

  // Check if todo exists
  const [existing] = await db.select().from(todos).where(eq(todos.id, id));

  if (!existing) {
    return c.json({ error: "Todo not found" }, 404);
  }

  const [updated] = await db
    .update(todos)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(todos.id, id))
    .returning();

  return c.json(updated);
});

// DELETE /todos/:id - Delete todo
app.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const [existing] = await db.select().from(todos).where(eq(todos.id, id));

  if (!existing) {
    return c.json({ error: "Todo not found" }, 404);
  }

  await db.delete(todos).where(eq(todos.id, id));

  return c.body(null, 204);
});

export { app as todoRoutes };
```

### test/api.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "../src/index";
import { db } from "../src/db";
import { todos } from "../src/db/schema";
import { sql } from "drizzle-orm";

describe("Todo API", () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.delete(todos);
  });

  describe("POST /todos", () => {
    it("should create a new todo", async () => {
      const response = await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Todo",
          description: "Test description",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.title).toBe("Test Todo");
      expect(data.completed).toBe(false);
    });

    it("should return 400 for missing title", async () => {
      const response = await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "No title" }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /todos", () => {
    it("should return empty array when no todos", async () => {
      const response = await app.request("/todos");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it("should return all todos", async () => {
      // Create test todos
      await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Todo 1" }),
      });

      await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Todo 2" }),
      });

      const response = await app.request("/todos");
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
    });
  });

  describe("GET /todos/:id", () => {
    it("should return todo by id", async () => {
      // Create a todo
      const createResponse = await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test Todo" }),
      });

      const created = await createResponse.json();

      const response = await app.request(`/todos/${created.id}`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.title).toBe("Test Todo");
    });

    it("should return 404 for non-existent todo", async () => {
      const response = await app.request("/todos/999");
      expect(response.status).toBe(404);
    });
  });

  describe("PUT /todos/:id", () => {
    it("should update todo", async () => {
      // Create a todo
      const createResponse = await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Original" }),
      });

      const created = await createResponse.json();

      // Update the todo
      const response = await app.request(`/todos/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated", completed: true }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.title).toBe("Updated");
      expect(data.completed).toBe(true);
    });
  });

  describe("DELETE /todos/:id", () => {
    it("should delete todo", async () => {
      // Create a todo
      const createResponse = await app.request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Delete Me" }),
      });

      const created = await createResponse.json();

      // Delete the todo
      const response = await app.request(`/todos/${created.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await app.request(`/todos/${created.id}`);
      expect(getResponse.status).toBe(404);
    });
  });
});
```

### package.json

```json
{
  "name": "todo-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@hono/zod-validator": "^0.2.0",
    "drizzle-orm": "^0.29.0",
    "hono": "^4.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.20.0",
    "vitest": "^1.0.0"
  }
}
```

## Monitoring Progress

```bash
# Watch Ralph's progress
bun run src/index.ts status

# Check logs
tail -f .agent/logs/ralph.log
```

## Iteration Examples

### Iteration 1: Project Setup
- Creates project structure
- Initializes Hono application
- Sets up Drizzle ORM configuration

### Iteration 2-5: Model Implementation
- Creates Todo model
- Implements database schema
- Sets up migrations

### Iteration 6-10: API Endpoints
- Implements CRUD operations
- Adds routing
- Handles HTTP methods

### Iteration 11-15: Validation
- Adds input validation with Zod
- Implements error handling
- Creates response schemas

### Iteration 16-20: Testing
- Writes unit tests
- Ensures coverage
- Fixes any issues

### Final Iteration
- Creates README
- Adds package.json scripts
- Meets all requirements

## Tips for Success

1. **Clear Requirements**: Be specific about API endpoints and data models
2. **Include Examples**: Provide sample requests/responses if needed
3. **Test Requirements**: Specify testing framework and coverage expectations
4. **Error Handling**: Explicitly request proper error handling
5. **Documentation**: Ask for API documentation in README

## Common Issues and Solutions

### Issue: Database Connection Errors
```markdown
# Add to prompt:
Ensure database is properly initialized before first request.
Use Drizzle's migrate function for schema setup.
```

### Issue: Import Circular Dependencies
```markdown
# Add to prompt:
Avoid circular imports by separating db connection from schema.
Use barrel exports (index.ts) for clean imports.
```

### Issue: Test Failures
```markdown
# Add to prompt:
Use in-memory SQLite database for tests.
Ensure proper test isolation with beforeEach cleanup.
```

## Extending the Example

### Add Authentication
```markdown
## Additional Requirements
- JWT authentication with Hono JWT middleware
- User registration and login
- Protected endpoints
- Role-based access control
```

### Add Pagination
```markdown
## Additional Requirements
- Paginate GET /todos endpoint
- Support page and limit query parameters
- Return pagination metadata (total, hasNext, hasPrev)
```

### Add Filtering
```markdown
## Additional Requirements
- Filter todos by completed status
- Search todos by title
- Sort by createdAt or updatedAt
```

## Cost Estimation

- **Iterations**: ~20-30 for complete implementation
- **Time**: ~10-15 minutes
- **Agent**: Claude recommended for complex logic
- **API Calls**: ~$0.20-0.30 (Claude pricing)

## Verification

After Ralph completes:

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start server
bun run dev

# Test endpoints
curl http://localhost:3000/todos

curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Todo"}'

curl http://localhost:3000/todos/1

curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

curl -X DELETE http://localhost:3000/todos/1
```
