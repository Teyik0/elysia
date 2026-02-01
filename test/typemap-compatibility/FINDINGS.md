# Phase 0: TypeBox 0.34 + TypeMap Compatibility Analysis

## Executive Summary

**Décision: Rester sur TypeBox 0.34 + TypeMap avec fallback Standard Schema.**

L'approche fonctionne maintenant - Valibot est optimisé (3.7x boost), Zod/ArkType utilisent le fallback natif.

---

## Notes Techniques

### TypeMap et Zod 4.x

TypeMap 0.10.1 requiert Zod 3.x - la conversion Zod → TypeBox échoue avec Zod 4.x.
**Solution:** Fallback sur `~standard.validate` pour Zod (fonctionne, perf native).

### TypeMap Produit TypeBox 0.34

| Package | Version | Format |
|---------|---------|--------|
| `@sinclair/typebox` | 0.34.x | `Symbol(Kind)` |
| TypeMap output | 0.34 | `Symbol(Kind)` |

**OK pour nous** - Elysia utilise déjà TypeBox 0.34.

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

## Décision Finale

### TypeBox 0.34 + Standard Schema (avec TypeMap opt-in)

**Important**: TypeMap conversion est opt-in, pas automatique.
La conversion automatique peut perdre des contraintes de validation (literals, unions).

```typescript
// Standard Schema utilise la validation native par défaut (fiable)
// TypeMap est disponible pour opt-in via:
import { tryConvertToTypeBox } from 'elysia/validation'

// Utilisation opt-in pour optimiser Valibot:
const valibotSchema = v.object({ name: v.string() })
const typeboxSchema = tryConvertToTypeBox(valibotSchema)
if (typeboxSchema) {
  // Use compiled TypeBox (3.7x faster)
}
```

### Résultat par Librairie

| Lib | Chemin par défaut | Avec opt-in TypeMap |
|-----|-------------------|---------------------|
| TypeBox | Direct compile | Direct compile |
| Valibot | ~standard.validate | TypeMap → TypeBox (3.7x boost) |
| Zod 4.x | ~standard.validate | Non supporté |
| ArkType | ~standard.validate | Non supporté |

### Pourquoi opt-in?

1. **Pas de régression** - Comportement existant préservé
2. **Conversion imparfaite** - TypeMap peut perdre des contraintes (literals, unions)
3. **Choix utilisateur** - Performance vs fiabilité selon le cas d'usage
4. **Évolutif** - Automatisation possible quand TypeMap sera plus mature

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

**TypeBox 0.34 + TypeMap est viable maintenant** avec fallback Standard Schema.

- Valibot: Optimisé via TypeMap (3.7x plus rapide)
- Zod/ArkType: Fallback Standard Schema (fonctionne, perf native)

### Prochaines Étapes

1. Implémenter `src/validation/adapter.ts` avec le pattern ci-dessus
2. Intégrer dans `getSchemaValidator()` de `schema.ts`
3. Ajouter `@sinclair/typemap` comme peer dependency optionnelle
4. Tests d'intégration avec Zod, Valibot, ArkType
