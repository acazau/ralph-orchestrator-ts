/**
 * Greeting Service Module
 *
 * Provides various greeting functions with validation and time-based customization.
 */

/**
 * Generates a simple greeting for a given name.
 *
 * @param name - The name of the person to greet
 * @returns A greeting string in the format "Hello, {name}!"
 * @throws Error if name is empty after trimming
 *
 * @example
 * ```typescript
 * greet("Alice") // Returns "Hello, Alice!"
 * greet("  Bob  ") // Returns "Hello, Bob!"
 * ```
 */
export function greet(name: string | null | undefined): string {
  const sanitizedName = sanitizeName(name);
  if (sanitizedName === null) {
    throw new Error('Name cannot be empty');
  }
  return `Hello, ${sanitizedName}!`;
}

/**
 * Generates greetings for multiple people.
 *
 * @param names - Array of names to greet
 * @returns Array of greeting strings, skipping invalid/empty names
 *
 * @example
 * ```typescript
 * greetMultiple(["Alice", "Bob"]) // Returns ["Hello, Alice!", "Hello, Bob!"]
 * greetMultiple(["Alice", "", "Bob"]) // Returns ["Hello, Alice!", "Hello, Bob!"]
 * ```
 */
export function greetMultiple(
  names: Array<string | null | undefined>
): string[] {
  const greetings: string[] = [];

  for (const name of names) {
    const sanitizedName = sanitizeName(name);
    if (sanitizedName !== null) {
      greetings.push(`Hello, ${sanitizedName}!`);
    }
  }

  return greetings;
}

/**
 * Gets the current hour for time-based greeting determination.
 * Extracted for testability.
 *
 * @returns The current hour (0-23)
 */
export function getCurrentHour(): number {
  return new Date().getHours();
}

/**
 * Generates a time-appropriate greeting for a given name.
 *
 * Time ranges:
 * - Good morning: 5am - 12pm (5-11)
 * - Good afternoon: 12pm - 5pm (12-16)
 * - Good evening: 5pm - 9pm (17-20)
 * - Good night: 9pm - 5am (21-4)
 *
 * @param name - The name of the person to greet
 * @param hourProvider - Optional function to get the current hour (for testing)
 * @returns A time-based greeting string
 * @throws Error if name is empty after trimming
 *
 * @example
 * ```typescript
 * // At 10am:
 * getTimeBasedGreeting("Alice") // Returns "Good morning, Alice!"
 * // At 2pm:
 * getTimeBasedGreeting("Bob") // Returns "Good afternoon, Bob!"
 * ```
 */
export function getTimeBasedGreeting(
  name: string | null | undefined,
  hourProvider: () => number = getCurrentHour
): string {
  const sanitizedName = sanitizeName(name);
  if (sanitizedName === null) {
    throw new Error('Name cannot be empty');
  }

  const hour = hourProvider();
  const greeting = getGreetingForHour(hour);

  return `${greeting}, ${sanitizedName}!`;
}

/**
 * Determines the appropriate greeting based on the hour of the day.
 *
 * @param hour - The hour (0-23)
 * @returns The appropriate greeting prefix
 */
function getGreetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'Good evening';
  }
  return 'Good night';
}

/**
 * Sanitizes a name input by trimming whitespace and handling null/undefined.
 *
 * @param name - The name to sanitize
 * @returns The trimmed name, or null if the input is invalid/empty
 */
function sanitizeName(name: string | null | undefined): string | null {
  if (name === null || name === undefined) {
    return null;
  }

  const trimmed = name.trim();
  if (trimmed === '') {
    return null;
  }

  return trimmed;
}
