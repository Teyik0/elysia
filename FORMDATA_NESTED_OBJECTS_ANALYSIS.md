# FormData Nested Objects: Implementation Analysis

## Context

This document analyzes the implementation approaches for handling nested objects/arrays in FormData submissions when Files are present. The work happened across 4 commits on the `fix-nested-formdata` branch.

## Commit History

### 1. `000ba5a9` - Refactor: replace schema type function and enhance it
- Created new `src/replace-schema.ts` with generic schema transformation utilities
- Moved schema manipulation logic from `src/schema.ts` to dedicated module
- Added `replaceSchemaTypeFromManyOptions()` for flexible schema transformations
- Improved handling of edge cases (unions, refs, optional wrapping)

### 2. `d658f0c8` - Feat: auto formdata coercion + fix t.Optional paired with t.ObjectString
- Added `coerceFormData()` function to automatically transform schemas
- Transforms `t.Object` → `t.ObjectString` when Files detected
- Transforms `t.Array` → `t.ArrayString` when Files detected
- Fixed issues with `t.Optional` wrapping `ObjectString`/`ArrayString`

### 3. `aeaa52f0` - Feat: nested data formdata auto coercion
- Added **runtime JSON parsing** in `src/compose.ts` and `src/dynamic-handle.ts`
- Automatically parses FormData string values that look like JSON (start with `{` or `[`)
- Happens during body parsing, before validation
- Works with any schema validator (TypeBox, Zod, Valibot)

### 4. `8a545e46` - Fix: resolve model references for File detection and add StandardSchema type support
- Improved File detection to resolve model references (`.model('user', ...)`)
- Added StandardSchema support (Zod, Valibot) for File detection
- Enhanced `hasType()` to properly traverse schema references

## Two Approaches Comparison

| Critère | Runtime Parsing (Current) | Schema Coercion (coerceFormData) |
|---------|---------------------------|----------------------------------|
| **Location** | `src/compose.ts` + `src/dynamic-handle.ts` | `src/replace-schema.ts` + `src/index.ts` |
| **When Active** | During FormData parsing (before validation) | During schema compilation (once, cached) |
| **How It Works** | Parse JSON strings → validate objects | Transform schema → validate with ObjectString |
| **Performance - Parsing** | ❌ Parse at every request<br>• `trim()` + `charCodeAt()` on each value<br>• `JSON.parse()` with try-catch per field | ✅ Parse via compiled TypeBox validators<br>• Optimized JIT validators cached<br>• Single Transform.Decode pass |
| **Performance - Validation** | ✅ Direct object validation<br>• Single pass through schema | ❌ Union validation<br>• String branch check → Object branch<br>• Transform.Decode overhead |
| **Performance - Schema** | ✅ No transformation<br>• Original schema used as-is | ❌ One-time transformation<br>• Full schema tree walk |
| **Precision** | ❌ Parses ALL JSON-like strings<br>• `description: '{"x": 1}'` → object even if String expected | ✅ Only parses declared Object/Array types<br>• Respects schema exactly |
| **Validation Errors** | ✅ Perfect<br>• `property: "/categories/0/name"`<br>• Precise paths maintained | ✅ Perfect<br>• Same quality errors |
| **Multi-validator Support** | ✅ Works with Zod, Valibot, etc.<br>• StandardSchema compatible | ❌ TypeBox only<br>• Relies on TypeBox Transform API |
| **Code Complexity** | ✅ ~30 lines of simple code<br>• Easy to maintain | ❌ ~100+ lines<br>• Tree walking, edge cases |
| **Edge Cases** | ⚠️ May parse unintended fields | ✅ Precise control via schema |
| **DX - Transparency** | ✅ "Magic" but intuitive behavior | ✅ Follows TypeBox Transform pattern |
| **Memory Overhead** | ✅ None (no caching) | ❌ Transformed schemas in memory |

## The Precision Problem

### Runtime Parsing Issue:
```typescript
// User submits JSON as a string field
const formData = new FormData()
formData.append('description', '{"note": "User feedback"}')  // User wrote JSON
formData.append('image', file)

// Schema expects a string
body: t.Object({
  description: t.String(),  // Expects STRING
  image: t.File()
})

// ❌ Runtime parser sees {"note": "User feedback"} and parses it
// → Validation fails: expected string, got object
```

### Schema Coercion Behavior:
```typescript
// Same FormData
// ✅ coerceFormData() doesn't transform t.String()
// → description stays as string, validation passes
```

## Validation Error Quality Test

Both approaches maintain perfect validation error paths:

```typescript
body: t.Object({
  categories: t.Array(t.Object({
    name: t.String({ pattern: '^[A-Z]' })  // Must start with uppercase
  })),
  image: t.File()
})

// Input: categories: [{ name: 'electronics' }]  // lowercase

// Error response (both approaches):
{
  "property": "/categories/0/name",
  "path": "/categories/0/name",
  "value": "electronics",
  "message": "Expected string to match '^[A-Z]'"
}
```

## Current Implementation (Hybrid Approach)

The codebase currently uses **Runtime Parsing** but keeps **Schema Coercion** infrastructure:

### Why Runtime Parsing Was Chosen:
1. **StandardSchema Support** - Works with Zod, Valibot out of the box
2. **Simpler Code** - 30 lines vs 100+ lines
3. **User Transparency** - Natural schema writing: `t.Object({ ... })`

### Why Schema Coercion Infrastructure Is Kept:
1. **Better in replace-schema.ts** - Handles more edge cases than old implementation
2. **Reusable** - Can be used for other transformations
3. **Future-proof** - TypeBox-specific optimizations might be needed later

## Code Samples

### Runtime Parsing (compose.ts):
```typescript
if (hasFiles) {
    fnLiteral += '\nc.body={}\n'
    fnLiteral += `const form=await c.request.formData()\n`
    
    fnLiteral += `if(form){for(const key of form.keys()){` +
        `if(c.body[key])continue;` +
        `const values=form.getAll(key);` +
        `const parsed=values.map(v=>{` +
        `if(v instanceof File)return v;` +
        `if(typeof v==='string'){` +
        `const t=v.trim();const fc=t.charCodeAt(0);` +
        `if(fc===123||fc===91){try{return JSON.parse(t)}catch{}}` +
        `}return v});` +
        `c.body[key]=parsed.length===1?parsed[0]:parsed}}\n`
}
```

### Schema Coercion (index.ts):
```typescript
additionalCoerce: (() => {
    const resolved = resolveSchema(cloned.body, models, modules)
    return (resolved && Kind in resolved && (hasType('File', resolved) || hasType('Files', resolved)))
        ? coerceFormData()  // Transform Object → ObjectString
        : coercePrimitiveRoot()
})()
```

### Schema Transformation (replace-schema.ts):
```typescript
export const coerceFormData = () => {
    if (!_coerceFormData)
        _coerceFormData = [
            {
                from: t.Object({}),
                to: (schema) => t.ObjectString(schema.properties ?? {}, schema),
                onlyFirst: 'object',
                excludeRoot: true
            },
            {
                from: t.Array(t.Any()),
                to: (schema) => t.ArrayString(schema.items ?? t.Any(), schema),
                onlyFirst: 'array',
                excludeRoot: true
            },
        ]
    return _coerceFormData
}
```

## Recommendations

### If StandardSchema Support Is Critical:
**Keep Runtime Parsing** but improve precision:
```typescript
// Only parse if schema at this path expects Object/Array
// Requires schema introspection during parsing
const shouldParse = schemaExpectsObjectOrArray(key, bodySchema)
if (shouldParse && (fc === 123 || fc === 91)) {
    try { return JSON.parse(t) } catch {}
}
```

### If TypeBox-Only Is Acceptable:
**Switch to Schema Coercion** for:
- Better performance (compiled validators)
- Precise parsing control
- No false positives on user input

### Current Status:
- ✅ Runtime Parsing is active and working
- ✅ Schema Coercion infrastructure exists but unused for FormData
- ✅ Tests pass for both approaches
- ⚠️ Potential issue: User JSON strings might be parsed unintentionally

## Conclusion

The `replace-schema.ts` refactor (commits 1-2) is valuable and should be kept because:
1. Handles more edge cases than old implementation
2. Cleaner architecture with dedicated module
3. Reusable for other schema transformations
4. Better handling of unions, refs, optional wrapping

The Runtime Parsing approach (commit 3) was chosen for broader validator support, but introduces a precision trade-off that should be monitored in production use.
