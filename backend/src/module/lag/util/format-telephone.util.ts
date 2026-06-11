const PHONE_DB_MAX_LENGTH = 30;

function extractNationalDigits(trimmed: string, digits: string): { national: string; international: boolean } {
    const international =
        (trimmed.startsWith('+') && digits.startsWith('32')) ||
        digits.startsWith('0032') ||
        (digits.startsWith('32') && !digits.startsWith('0'));

    let national = digits;

    if (international) {
        if (national.startsWith('0032')) {
            national = national.slice(4);
        } else if (national.startsWith('32')) {
            national = national.slice(2);
        }
    }

    if (national.startsWith('0')) {
        national = national.slice(1);
    }

    return { national, international };
}

function formatNationalNumber(national: string): string {
    if (national.length >= 9) {
        const n = national.slice(0, 9);
        return `0${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
    }
    if (national.length === 8) {
        return `0${national.slice(0, 1)} ${national.slice(1, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)}`;
    }
    return `0${national}`;
}

function formatInternationalNumber(national: string): string {
    if (national.length >= 9) {
        const n = national.slice(0, 9);
        return `+32 (0)${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
    }
    if (national.length === 8) {
        return `+32 (0)${national.slice(0, 1)} ${national.slice(1, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)}`;
    }
    return `+32 (0)${national}`;
}

/** Normalise un numéro belge : international « +32 (0)472 09 65 63 », national « 0472 09 65 63 ». */
export function formatTelephoneBE(input: string | null | undefined): string | null {
    if (input == null) {
        return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) {
        return null;
    }

    const { national, international } = extractNationalDigits(trimmed, digits);
    const formatted = international
        ? formatInternationalNumber(national)
        : formatNationalNumber(national);

    return formatted.slice(0, PHONE_DB_MAX_LENGTH);
}
