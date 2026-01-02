/**
 * Fuzzy string matching utilities for loop detection
 */

import * as fuzzball from "fuzzball";

/**
 * Calculate similarity ratio between two strings
 * @param a First string
 * @param b Second string
 * @returns Similarity ratio (0-1)
 */
export function similarityRatio(a: string, b: string): number {
	if (!a || !b) return 0;
	if (a === b) return 1;

	// Use fuzzball's ratio function which returns 0-100
	const ratio = fuzzball.ratio(a, b);
	return ratio / 100;
}

/**
 * Check if two strings are similar above a threshold
 * @param a First string
 * @param b Second string
 * @param threshold Similarity threshold (0-1, default 0.9)
 * @returns True if strings are similar
 */
export function isSimilar(a: string, b: string, threshold = 0.9): boolean {
	return similarityRatio(a, b) >= threshold;
}

/**
 * Find the most similar string in a list
 * @param target Target string to match
 * @param candidates List of candidate strings
 * @returns Best match with similarity score, or null if no candidates
 */
export function findBestMatch(
	target: string,
	candidates: string[],
): { match: string; score: number } | null {
	if (!candidates.length) return null;

	let bestMatch = candidates[0]!;
	let bestScore = similarityRatio(target, bestMatch);

	for (let i = 1; i < candidates.length; i++) {
		const score = similarityRatio(target, candidates[i]!);
		if (score > bestScore) {
			bestMatch = candidates[i]!;
			bestScore = score;
		}
	}

	return { match: bestMatch, score: bestScore };
}

/**
 * Check if a string matches any in a list above threshold
 * @param target Target string to match
 * @param candidates List of candidate strings
 * @param threshold Similarity threshold (0-1)
 * @returns Index of matching string, or -1 if no match
 */
export function findSimilarIndex(
	target: string,
	candidates: string[],
	threshold = 0.9,
): number {
	for (let i = 0; i < candidates.length; i++) {
		if (similarityRatio(target, candidates[i]!) >= threshold) {
			return i;
		}
	}
	return -1;
}

/**
 * Partial ratio comparison (better for substring matching)
 * @param a First string
 * @param b Second string
 * @returns Partial similarity ratio (0-1)
 */
export function partialRatio(a: string, b: string): number {
	if (!a || !b) return 0;
	if (a === b) return 1;

	const ratio = fuzzball.partial_ratio(a, b);
	return ratio / 100;
}

/**
 * Token sort ratio (ignores word order)
 * @param a First string
 * @param b Second string
 * @returns Token sort similarity ratio (0-1)
 */
export function tokenSortRatio(a: string, b: string): number {
	if (!a || !b) return 0;
	if (a === b) return 1;

	const ratio = fuzzball.token_sort_ratio(a, b);
	return ratio / 100;
}
