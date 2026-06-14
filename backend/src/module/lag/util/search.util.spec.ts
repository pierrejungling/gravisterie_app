import {
    getFrenchWordVariants,
    levenshteinDistance,
    matchesFlexibleSearch,
    normalizeSearchText,
    scoreFlexibleSearch,
} from './search.util';

describe('search.util', () => {
    describe('normalizeSearchText', () => {
        it('ignore la casse et les accents', () => {
            expect(normalizeSearchText('Éléonore Müller')).toBe('eleonore muller');
        });
    });

    describe('getFrenchWordVariants', () => {
        it('produit des variantes singulier/pluriel', () => {
            expect(getFrenchWordVariants('gravures')).toContain('gravure');
            expect(getFrenchWordVariants('trophees')).toContain('trophee');
        });
    });

    describe('matchesFlexibleSearch', () => {
        it('trouve malgré accents et majuscules', () => {
            expect(matchesFlexibleSearch('Trophée gravé pour Dupont', 'trophee')).toBe(true);
        });

        it('trouve malgré un pluriel', () => {
            expect(matchesFlexibleSearch('Commande de gravures sur bois', 'gravure')).toBe(true);
        });

        it('trouve malgré une petite faute', () => {
            expect(matchesFlexibleSearch('Plaque personnalisée Martin', 'personnalise')).toBe(true);
        });

        it('rejette une requête sans correspondance', () => {
            expect(matchesFlexibleSearch('Plaque personnalisée Martin', 'zucchini')).toBe(false);
        });
    });

    describe('scoreFlexibleSearch', () => {
        it('classe une correspondance exacte plus haut', () => {
            const exact = scoreFlexibleSearch('Gravure Dupont', 'gravure dupont');
            const partial = scoreFlexibleSearch('Gravure Dupont', 'dup');
            expect(exact).toBeGreaterThan(partial);
        });
    });

    describe('levenshteinDistance', () => {
        it('calcule la distance entre deux mots', () => {
            expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
        });
    });
});
