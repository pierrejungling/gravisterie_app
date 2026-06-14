export function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9@.+]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export function getFrenchWordVariants(word: string): string[] {
    const variants = new Set<string>([word]);
    if (word.length <= 2) {
        return [...variants];
    }

    if (word.endsWith('eaux') && word.length > 5) {
        variants.add(word.slice(0, -4) + 'eau');
    }
    if (word.endsWith('aux') && word.length > 4) {
        variants.add(word.slice(0, -3) + 'al');
    }
    if (word.endsWith('eux') && word.length > 4) {
        variants.add(word.slice(0, -3) + 'eu');
    }
    if (word.endsWith('es') && word.length > 3) {
        variants.add(word.slice(0, -2));
    }
    if (word.endsWith('s') && word.length > 2) {
        variants.add(word.slice(0, -1));
    }
    if (word.endsWith('x') && word.length > 2) {
        variants.add(word.slice(0, -1));
    }

    return [...variants];
}

export function levenshteinDistance(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    if (!a.length) {
        return b.length;
    }
    if (!b.length) {
        return a.length;
    }

    const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            );
        }
    }

    return matrix[a.length][b.length];
}

function maxAllowedDistance(wordLength: number): number {
    if (wordLength <= 3) {
        return 0;
    }
    if (wordLength <= 5) {
        return 1;
    }
    if (wordLength <= 8) {
        return 2;
    }
    return 3;
}

function tokenMatchesHaystack(
    queryToken: string,
    haystackTokens: string[],
    fullHaystack: string,
): { match: boolean; score: number } {
    const queryVariants = getFrenchWordVariants(queryToken);

    for (const variant of queryVariants) {
        if (fullHaystack.includes(variant)) {
            return { match: true, score: variant === queryToken ? 40 : 30 };
        }
    }

    let bestScore = 0;

    for (const hayToken of haystackTokens) {
        for (const variant of queryVariants) {
            if (hayToken === variant) {
                return { match: true, score: 50 };
            }

            const hayVariants = getFrenchWordVariants(hayToken);
            for (const hayVariant of hayVariants) {
                if (hayVariant === variant) {
                    bestScore = Math.max(bestScore, 35);
                }
            }

            const maxDistance = maxAllowedDistance(Math.min(variant.length, hayToken.length));
            if (maxDistance > 0 && levenshteinDistance(variant, hayToken) <= maxDistance) {
                bestScore = Math.max(bestScore, 20);
            }

            if (hayToken.startsWith(variant) || variant.startsWith(hayToken)) {
                bestScore = Math.max(bestScore, 25);
            }
        }
    }

    return { match: bestScore > 0, score: bestScore };
}

export function scoreFlexibleSearch(haystack: string, query: string): number {
    const normalizedHaystack = normalizeSearchText(haystack);
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery || normalizedQuery.length < 2) {
        return 0;
    }

    const queryTokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
    const haystackTokens = normalizedHaystack.split(' ').filter((token) => token.length > 0);

    if (normalizedHaystack.includes(normalizedQuery)) {
        return 100 + normalizedQuery.length;
    }

    let totalScore = 0;
    for (const token of queryTokens) {
        const result = tokenMatchesHaystack(token, haystackTokens, normalizedHaystack);
        if (!result.match) {
            return 0;
        }
        totalScore += result.score;
    }

    return totalScore;
}

export function matchesFlexibleSearch(haystack: string, query: string): boolean {
    return scoreFlexibleSearch(haystack, query) > 0;
}
