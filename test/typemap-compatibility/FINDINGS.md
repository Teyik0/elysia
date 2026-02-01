# Phase 0: TypeBox 1.0 + TypeMap Compatibility Analysis

## Executive Summary

Cette analyse révèle des **blockers critiques** pour l'adoption immédiate de TypeMap avec Elysia, mais confirme que TypeBox 1.0 est viable pour une migration future.

---

## Findings Critiques

### 1. TypeMap Incompatible avec Zod 4.x

| Problème | Impact |
|----------|--------|
| TypeMap 0.10.1 requiert `zod@^3.24.1` | Elysia utilise `zod@^4.1.5` |
| `TypeError: Right hand side of instanceof is not an object` | Conversion Zod → TypeBox impossible |

**Erreur observée:**
```
TypeError: Right hand side of instanceof is not an object
  at FromType (typebox-from-zod.mjs:175:49)
```

**Action requise:** Attendre mise à jour TypeMap pour Zod 4.x support

---

### 2. TypeMap Produit TypeBox 0.34, Pas 1.0

| Package | Version | Format |
|---------|---------|--------|
| `@sinclair/typebox` | 0.34.x | `Symbol(Kind)` |
| `typebox` | 1.0.x | `~kind` property |
| TypeMap output | 0.34 | `Symbol(Kind)` |

**Implication:** On ne peut pas utiliser TypeMap pour générer des schémas TypeBox 1.0 directement.

---

### 3. TypeBox 1.0 API Changes

#### Transform → Codec
```typescript
// TypeBox 0.34
Type.Transform(schema).Decode(...).Encode(...)
// Résultat: schema[TransformKind] = true

// TypeBox 1.0
Type.Codec(schema).Decode(...).Encode(...)
// Résultat: schema['~codec'] = { decode, encode }
// NOTE: ~kind reste le type original (Union, Object, etc.)
```

#### Symbols → Properties
```typescript
// 0.34                    // 1.0
schema[Kind]          →    schema['~kind']
schema[OptionalKind]  →    schema['~optional']
schema[TransformKind] →    schema['~codec']
```

#### Types Supprimés
- `Type.Date` → Créer custom type avec `Type.Unsafe<Date>`
- `Type.Uint8Array` → Créer custom type
- `Type.Recursive` → Utiliser `Type.Cyclic`

---

## Benchmarks Performance

| Validator | 10,000 iterations | Per iteration | vs TypeBox 1.0 |
|-----------|-------------------|---------------|----------------|
| TypeBox 1.0 Compile | **0.95ms** | 0.0001ms | 1x (baseline) |
| TypeMap Compile | 1.17ms | 0.0001ms | 1.23x |
| TypeBox 0.34 TypeCompiler | 1.35ms | 0.0001ms | 1.42x |
| Valibot via TypeMap | 1.56ms | 0.0002ms | 1.64x |
| **Valibot native** | **5.80ms** | 0.0006ms | **6.1x slower** |

### Insight Clé
**Valibot via TypeMap est 3.7x plus rapide que Valibot natif!**

Cela valide l'approche de conversion Standard Schema → TypeBox pour la performance.

---

## Compatibilité Testée

### TypeBox 1.0

| Feature | Status | Notes |
|---------|--------|-------|
| Basic types (String, Number, Object) | ✅ | Fonctionne |
| Type.Codec (bidirectionnel) | ✅ | API différente de Transform |
| Type.Optional | ✅ | Utilise `~optional` |
| Compile validation | ✅ | Très performant |
| Type.Module | ✅ | Existe toujours |
| Type.Cyclic | ✅ | Remplace Recursive |
| Type.Date | ❌ | Supprimé, besoin custom |
| Type.Uint8Array | ❌ | Supprimé, besoin custom |

### TypeMap 0.10.1

| Feature | Status | Notes |
|---------|--------|-------|
| Zod → TypeBox | ❌ | Incompatible Zod 4.x |
| Valibot → TypeBox | ✅ | Fonctionne bien |
| Syntax → TypeBox | ✅ | `Compile('{ name: string }')` |
| TNever detection | ✅ | `schema[Kind] === 'Never'` |
| Standard Schema output | ✅ | Via `['~standard'].validate` |

---

## Stratégie Recommandée (Mise à Jour)

### Option A: Attendre TypeMap 1.0 (Recommandé)

**Prérequis:**
1. TypeMap supporte Zod 4.x
2. TypeMap produit TypeBox 1.0 schemas
3. TypeMap supporté/maintenu activement

**Timeline estimée:** Dépend de @sinclairzx81

### Option B: Migration TypeBox 1.0 Sans TypeMap

**Approche:**
1. Migrer Elysia vers TypeBox 1.0
2. Garder Standard Schema via `['~standard'].validate` comme fallback
3. Pas de compilation optimisée pour Zod/Valibot (utilise leur validation native)

```typescript
// Adapter simplifié sans TypeMap
export function toValidator(schema: unknown) {
  // TypeBox 1.0 - compilation optimisée
  if (isTypeBox10(schema)) {
    return Compile(schema)
  }

  // Standard Schema - validation native (pas de boost perf)
  if ('~standard' in schema) {
    return schema['~standard']
  }

  throw new Error('Unsupported schema')
}
```

**Avantages:**
- Pas de dépendance externe problématique
- Migration plus simple
- Performance TypeBox native

**Inconvénients:**
- Zod/Valibot restent 6x plus lents que TypeBox

### Option C: Fork/Contribuer à TypeMap

Contribuer au projet TypeMap pour:
1. Support Zod 4.x
2. Output TypeBox 1.0

---

## Fichiers de Test

- `test/typemap-compatibility/validation.test.ts` - 35 tests
  - 31 pass
  - 4 skip (Zod 4.x incompatible)

## Commande pour Exécuter

```bash
bun test test/typemap-compatibility/validation.test.ts
```

---

## Conclusion

**TypeMap n'est pas prêt pour Elysia aujourd'hui** à cause de:
1. Incompatibilité Zod 4.x
2. Output TypeBox 0.34 (pas 1.0)

**Recommandation:**
1. Ouvrir une issue sur TypeMap pour Zod 4.x + TypeBox 1.0 support
2. En attendant, planifier migration TypeBox 1.0 seul (Option B)
3. Ajouter TypeMap quand il sera compatible

---

## Dépendances Actuelles vs Requises

```json
// Actuel (package.json)
{
  "peerDependencies": {
    "@sinclair/typebox": ">= 0.34.0 < 1"
  },
  "devDependencies": {
    "zod": "^4.1.5",
    "@sinclair/typemap": "^0.10.1"  // Requiert zod@^3.24.1
  }
}

// Conflit: TypeMap veut Zod 3.x, Elysia utilise Zod 4.x
```
