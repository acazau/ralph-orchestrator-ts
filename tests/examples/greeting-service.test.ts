import { describe, expect, it } from 'bun:test';
import {
  getCurrentHour,
  getTimeBasedGreeting,
  greet,
  greetMultiple,
} from '../../src/examples/greeting-service';

describe('greet', () => {
  describe('valid inputs', () => {
    it('should return a greeting for a simple name', () => {
      expect(greet('Alice')).toBe('Hello, Alice!');
    });

    it('should trim whitespace from names', () => {
      expect(greet('  Bob  ')).toBe('Hello, Bob!');
    });

    it('should handle names with leading whitespace', () => {
      expect(greet('   Charlie')).toBe('Hello, Charlie!');
    });

    it('should handle names with trailing whitespace', () => {
      expect(greet('Diana   ')).toBe('Hello, Diana!');
    });

    it('should handle single character names', () => {
      expect(greet('X')).toBe('Hello, X!');
    });

    it('should handle names with spaces in the middle', () => {
      expect(greet('Mary Jane')).toBe('Hello, Mary Jane!');
    });

    it('should handle names with special characters', () => {
      expect(greet("O'Connor")).toBe("Hello, O'Connor!");
    });

    it('should handle names with numbers', () => {
      expect(greet('R2D2')).toBe('Hello, R2D2!');
    });

    it('should handle unicode names', () => {
      expect(greet('日本語')).toBe('Hello, 日本語!');
    });

    it('should handle names with emojis', () => {
      expect(greet('Star ⭐')).toBe('Hello, Star ⭐!');
    });
  });

  describe('invalid inputs', () => {
    it('should throw error for empty string', () => {
      expect(() => greet('')).toThrow('Name cannot be empty');
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => greet('   ')).toThrow('Name cannot be empty');
    });

    it('should throw error for null', () => {
      expect(() => greet(null)).toThrow('Name cannot be empty');
    });

    it('should throw error for undefined', () => {
      expect(() => greet(undefined)).toThrow('Name cannot be empty');
    });

    it('should throw error for tab characters only', () => {
      expect(() => greet('\t\t')).toThrow('Name cannot be empty');
    });

    it('should throw error for newline characters only', () => {
      expect(() => greet('\n\n')).toThrow('Name cannot be empty');
    });
  });
});

describe('greetMultiple', () => {
  describe('valid inputs', () => {
    it('should return greetings for all valid names', () => {
      const result = greetMultiple(['Alice', 'Bob', 'Charlie']);
      expect(result).toEqual([
        'Hello, Alice!',
        'Hello, Bob!',
        'Hello, Charlie!',
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(greetMultiple([])).toEqual([]);
    });

    it('should handle single name', () => {
      expect(greetMultiple(['Alice'])).toEqual(['Hello, Alice!']);
    });

    it('should trim whitespace from all names', () => {
      const result = greetMultiple(['  Alice  ', '  Bob  ']);
      expect(result).toEqual(['Hello, Alice!', 'Hello, Bob!']);
    });
  });

  describe('filtering invalid entries', () => {
    it('should skip empty strings', () => {
      const result = greetMultiple(['Alice', '', 'Bob']);
      expect(result).toEqual(['Hello, Alice!', 'Hello, Bob!']);
    });

    it('should skip null values', () => {
      const result = greetMultiple(['Alice', null, 'Bob']);
      expect(result).toEqual(['Hello, Alice!', 'Hello, Bob!']);
    });

    it('should skip undefined values', () => {
      const result = greetMultiple(['Alice', undefined, 'Bob']);
      expect(result).toEqual(['Hello, Alice!', 'Hello, Bob!']);
    });

    it('should skip whitespace-only strings', () => {
      const result = greetMultiple(['Alice', '   ', 'Bob']);
      expect(result).toEqual(['Hello, Alice!', 'Hello, Bob!']);
    });

    it('should handle array with all invalid values', () => {
      const result = greetMultiple(['', null, undefined, '   ']);
      expect(result).toEqual([]);
    });

    it('should handle mixed valid and invalid values', () => {
      const result = greetMultiple([
        'Alice',
        '',
        null,
        'Bob',
        '   ',
        undefined,
        'Charlie',
      ]);
      expect(result).toEqual([
        'Hello, Alice!',
        'Hello, Bob!',
        'Hello, Charlie!',
      ]);
    });
  });
});

describe('getTimeBasedGreeting', () => {
  describe('morning greetings (5am - 11:59am)', () => {
    it('should return morning greeting at 5am', () => {
      const result = getTimeBasedGreeting('Alice', () => 5);
      expect(result).toBe('Good morning, Alice!');
    });

    it('should return morning greeting at 8am', () => {
      const result = getTimeBasedGreeting('Alice', () => 8);
      expect(result).toBe('Good morning, Alice!');
    });

    it('should return morning greeting at 11am', () => {
      const result = getTimeBasedGreeting('Alice', () => 11);
      expect(result).toBe('Good morning, Alice!');
    });
  });

  describe('afternoon greetings (12pm - 4:59pm)', () => {
    it('should return afternoon greeting at 12pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 12);
      expect(result).toBe('Good afternoon, Alice!');
    });

    it('should return afternoon greeting at 2pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 14);
      expect(result).toBe('Good afternoon, Alice!');
    });

    it('should return afternoon greeting at 4pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 16);
      expect(result).toBe('Good afternoon, Alice!');
    });
  });

  describe('evening greetings (5pm - 8:59pm)', () => {
    it('should return evening greeting at 5pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 17);
      expect(result).toBe('Good evening, Alice!');
    });

    it('should return evening greeting at 7pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 19);
      expect(result).toBe('Good evening, Alice!');
    });

    it('should return evening greeting at 8pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 20);
      expect(result).toBe('Good evening, Alice!');
    });
  });

  describe('night greetings (9pm - 4:59am)', () => {
    it('should return night greeting at 9pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 21);
      expect(result).toBe('Good night, Alice!');
    });

    it('should return night greeting at 11pm', () => {
      const result = getTimeBasedGreeting('Alice', () => 23);
      expect(result).toBe('Good night, Alice!');
    });

    it('should return night greeting at midnight', () => {
      const result = getTimeBasedGreeting('Alice', () => 0);
      expect(result).toBe('Good night, Alice!');
    });

    it('should return night greeting at 3am', () => {
      const result = getTimeBasedGreeting('Alice', () => 3);
      expect(result).toBe('Good night, Alice!');
    });

    it('should return night greeting at 4am', () => {
      const result = getTimeBasedGreeting('Alice', () => 4);
      expect(result).toBe('Good night, Alice!');
    });
  });

  describe('edge cases at time boundaries', () => {
    it('should return night at 4:59am (hour 4)', () => {
      const result = getTimeBasedGreeting('Alice', () => 4);
      expect(result).toBe('Good night, Alice!');
    });

    it('should return morning at 5:00am (hour 5)', () => {
      const result = getTimeBasedGreeting('Alice', () => 5);
      expect(result).toBe('Good morning, Alice!');
    });

    it('should return morning at 11:59am (hour 11)', () => {
      const result = getTimeBasedGreeting('Alice', () => 11);
      expect(result).toBe('Good morning, Alice!');
    });

    it('should return afternoon at 12:00pm (hour 12)', () => {
      const result = getTimeBasedGreeting('Alice', () => 12);
      expect(result).toBe('Good afternoon, Alice!');
    });

    it('should return afternoon at 4:59pm (hour 16)', () => {
      const result = getTimeBasedGreeting('Alice', () => 16);
      expect(result).toBe('Good afternoon, Alice!');
    });

    it('should return evening at 5:00pm (hour 17)', () => {
      const result = getTimeBasedGreeting('Alice', () => 17);
      expect(result).toBe('Good evening, Alice!');
    });

    it('should return evening at 8:59pm (hour 20)', () => {
      const result = getTimeBasedGreeting('Alice', () => 20);
      expect(result).toBe('Good evening, Alice!');
    });

    it('should return night at 9:00pm (hour 21)', () => {
      const result = getTimeBasedGreeting('Alice', () => 21);
      expect(result).toBe('Good night, Alice!');
    });
  });

  describe('name validation', () => {
    it('should throw error for empty string', () => {
      expect(() => getTimeBasedGreeting('', () => 12)).toThrow(
        'Name cannot be empty'
      );
    });

    it('should throw error for null', () => {
      expect(() => getTimeBasedGreeting(null, () => 12)).toThrow(
        'Name cannot be empty'
      );
    });

    it('should throw error for undefined', () => {
      expect(() => getTimeBasedGreeting(undefined, () => 12)).toThrow(
        'Name cannot be empty'
      );
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => getTimeBasedGreeting('   ', () => 12)).toThrow(
        'Name cannot be empty'
      );
    });

    it('should trim whitespace from name', () => {
      const result = getTimeBasedGreeting('  Alice  ', () => 12);
      expect(result).toBe('Good afternoon, Alice!');
    });
  });

  describe('default hour provider', () => {
    it('should use current time when no provider specified', () => {
      const result = getTimeBasedGreeting('Alice');
      expect(result).toMatch(/^Good (morning|afternoon|evening|night), Alice!$/);
    });
  });
});

describe('getCurrentHour', () => {
  it('should return a number between 0 and 23', () => {
    const hour = getCurrentHour();
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });

  it('should return an integer', () => {
    const hour = getCurrentHour();
    expect(Number.isInteger(hour)).toBe(true);
  });
});
