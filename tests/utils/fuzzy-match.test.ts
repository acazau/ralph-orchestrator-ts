/**
 * Tests for fuzzy string matching utilities
 */

import { describe, expect, test } from "bun:test";
import {
	similarityRatio,
	isSimilar,
	findBestMatch,
	findSimilarIndex,
	partialRatio,
	tokenSortRatio,
} from "../../src/utils/fuzzy-match.ts";

describe("similarityRatio", () => {
	test("should return 1 for identical strings", () => {
		expect(similarityRatio("hello", "hello")).toBe(1);
	});

	test("should return 0 for empty first string", () => {
		expect(similarityRatio("", "hello")).toBe(0);
	});

	test("should return 0 for empty second string", () => {
		expect(similarityRatio("hello", "")).toBe(0);
	});

	test("should return 0 for both empty strings", () => {
		expect(similarityRatio("", "")).toBe(0);
	});

	test("should return high ratio for similar strings", () => {
		const ratio = similarityRatio("hello world", "hello worlds");
		expect(ratio).toBeGreaterThan(0.8);
	});

	test("should return low ratio for different strings", () => {
		const ratio = similarityRatio("hello", "goodbye");
		expect(ratio).toBeLessThan(0.5);
	});

	test("should be case-insensitive (fuzzball default)", () => {
		// fuzzball is case-insensitive by default
		const ratio = similarityRatio("Hello", "hello");
		expect(ratio).toBe(1);
	});
});

describe("isSimilar", () => {
	test("should return true for identical strings", () => {
		expect(isSimilar("test", "test")).toBe(true);
	});

	test("should return true for similar strings above threshold", () => {
		expect(isSimilar("hello world", "hello world!", 0.9)).toBe(true);
	});

	test("should return false for different strings", () => {
		expect(isSimilar("hello", "goodbye", 0.9)).toBe(false);
	});

	test("should use default threshold of 0.9", () => {
		expect(isSimilar("test", "test")).toBe(true);
		expect(isSimilar("hello", "goodbye")).toBe(false);
	});

	test("should respect custom threshold", () => {
		const a = "hello";
		const b = "hallo";
		expect(isSimilar(a, b, 0.5)).toBe(true);
		expect(isSimilar(a, b, 0.95)).toBe(false);
	});
});

describe("findBestMatch", () => {
	test("should return null for empty candidates", () => {
		expect(findBestMatch("target", [])).toBeNull();
	});

	test("should find exact match", () => {
		const result = findBestMatch("hello", ["goodbye", "hello", "hi"]);
		expect(result).not.toBeNull();
		expect(result!.match).toBe("hello");
		expect(result!.score).toBe(1);
	});

	test("should find best match among similar strings", () => {
		const result = findBestMatch("hello", ["hallo", "hell", "help"]);
		expect(result).not.toBeNull();
		expect(result!.match).toBe("hell");
	});

	test("should return first candidate when single element", () => {
		const result = findBestMatch("target", ["only"]);
		expect(result).not.toBeNull();
		expect(result!.match).toBe("only");
	});

	test("should handle multiple candidates with same score", () => {
		const result = findBestMatch("ab", ["ab", "ab"]);
		expect(result).not.toBeNull();
		expect(result!.score).toBe(1);
	});
});

describe("findSimilarIndex", () => {
	test("should return -1 for empty candidates", () => {
		expect(findSimilarIndex("target", [])).toBe(-1);
	});

	test("should return index of exact match", () => {
		const index = findSimilarIndex("hello", ["goodbye", "hello", "hi"]);
		expect(index).toBe(1);
	});

	test("should return -1 when no match above threshold", () => {
		const index = findSimilarIndex("hello", ["goodbye", "farewell"], 0.9);
		expect(index).toBe(-1);
	});

	test("should respect custom threshold", () => {
		const candidates = ["hallo", "help", "world"];
		// With low threshold, should find match
		const lowThreshold = findSimilarIndex("hello", candidates, 0.5);
		expect(lowThreshold).toBeGreaterThanOrEqual(0);

		// With high threshold, should not find match
		const highThreshold = findSimilarIndex("hello", candidates, 0.99);
		expect(highThreshold).toBe(-1);
	});

	test("should return first match when multiple matches exist", () => {
		const index = findSimilarIndex("hello", ["hello", "hello", "hi"]);
		expect(index).toBe(0);
	});
});

describe("partialRatio", () => {
	test("should return 1 for identical strings", () => {
		expect(partialRatio("hello", "hello")).toBe(1);
	});

	test("should return 0 for empty first string", () => {
		expect(partialRatio("", "hello")).toBe(0);
	});

	test("should return 0 for empty second string", () => {
		expect(partialRatio("hello", "")).toBe(0);
	});

	test("should return high ratio for substring match", () => {
		const ratio = partialRatio("hello", "hello world");
		expect(ratio).toBe(1); // "hello" is contained in "hello world"
	});

	test("should handle partial matches", () => {
		const ratio = partialRatio("test", "testing");
		expect(ratio).toBeGreaterThan(0.8);
	});
});

describe("tokenSortRatio", () => {
	test("should return 1 for identical strings", () => {
		expect(tokenSortRatio("hello world", "hello world")).toBe(1);
	});

	test("should return 0 for empty first string", () => {
		expect(tokenSortRatio("", "hello")).toBe(0);
	});

	test("should return 0 for empty second string", () => {
		expect(tokenSortRatio("hello", "")).toBe(0);
	});

	test("should ignore word order", () => {
		const ratio = tokenSortRatio("hello world", "world hello");
		expect(ratio).toBe(1);
	});

	test("should handle multiple words", () => {
		const ratio = tokenSortRatio("a b c", "c b a");
		expect(ratio).toBe(1);
	});

	test("should return high ratio for similar content different order", () => {
		const ratio = tokenSortRatio("the quick brown fox", "brown fox the quick");
		expect(ratio).toBe(1);
	});
});
