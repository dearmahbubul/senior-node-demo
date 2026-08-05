// src/common/utils/prisma.util.ts
/**
 * Takes a model object and strips specific keys from the generic type signature
 */
export function excludeFields<T, K extends keyof T>(model: T, keys: K[]): Omit<T, K> {
    const cloned = { ...model };
    for (const key of keys) {
        delete cloned[key];
    }
    return cloned;
}
