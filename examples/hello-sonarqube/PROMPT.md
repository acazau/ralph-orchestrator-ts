# Task: Build a Greeting Service with SonarQube Quality Gates

## Objective
Create a simple greeting service module with full test coverage and zero SonarQube issues.

## Requirements

### Functionality
Create a `greeting-service.ts` module with:

1. `greet(name: string): string` - Returns "Hello, {name}!"
   - Validate name is not empty
   - Trim whitespace from name
   - Handle null/undefined gracefully

2. `greetMultiple(names: string[]): string[]` - Greet multiple people
   - Return array of greetings
   - Skip empty/invalid names

3. `getTimeBasedGreeting(name: string): string` - Time-aware greeting
   - "Good morning, {name}!" (5am-12pm)
   - "Good afternoon, {name}!" (12pm-5pm)
   - "Good evening, {name}!" (5pm-9pm)
   - "Good night, {name}!" (9pm-5am)

### Technical Requirements
- TypeScript with strict types
- Export all functions
- No `any` types
- Proper error handling
- JSDoc comments on public functions

### Test Requirements
Create `greeting-service.test.ts` with:
- Tests for all functions
- Edge cases (empty strings, null, special characters)
- Target: 100% code coverage

## Quality Process

After implementing, you MUST run SonarQube analysis:

```bash
# Run tests with coverage
bun test --coverage --coverage-reporter=lcov

# Run SonarQube scan
bun run ./.adws/adw_sonar_scan.ts full

# Check for issues
bun run ./.adws/adw_sonar_results.ts --status=OPEN
```

### Quality Gates (ALL must pass)
- [ ] Zero bugs
- [ ] Zero vulnerabilities
- [ ] Zero code smells (OPEN status)
- [ ] Coverage >= 80%
- [ ] Duplications < 3%

If any quality gate fails:
1. Read the specific issues from SonarQube
2. Fix each issue
3. Re-run the scan
4. Repeat until all gates pass

## File Structure
```
src/examples/
  greeting-service.ts
tests/examples/
  greeting-service.test.ts
```

## Completion Criteria
1. All functions implemented and working
2. All tests passing
3. SonarQube scan shows:
   - Quality Gate: PASSED
   - 0 open issues
   - Coverage >= 80%

When ALL criteria are met, output: TASK_COMPLETED
