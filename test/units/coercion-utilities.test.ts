import { describe, it, expect } from 'bun:test'
import { t } from '../../src'
import {
	stringToStructureCoercions,
	queryCoercions,
	coercePrimitiveRoot,
	coerceFormData,
	replaceSchemaTypeFromManyOptions as replaceSchemaType
} from '../../src/replace-schema'

describe('Coercion Utility Functions', () => {
	describe('stringToStructureCoercions', () => {
		it('should return cached coercions on subsequent calls', () => {
			const first = stringToStructureCoercions()
			const second = stringToStructureCoercions()

			expect(first).toBe(second) // Same reference
		})

		it('should transform nested Objects to ObjectString', () => {
			const schema = t.Object({
				metadata: t.Object({
					tags: t.Array(t.String())
				})
			})

			const result = replaceSchemaType(schema, stringToStructureCoercions())

			// Root should remain Object
			expect(result.type).toBe('object')
			expect(result.elysiaMeta).toBeUndefined()

			// Nested should be ObjectString
			expect(result.properties.metadata.elysiaMeta).toBe('ObjectString')
		})

		it('should transform Arrays to ArrayString', () => {
			const schema = t.Object({
				tags: t.Array(t.String())
			})

			const result = replaceSchemaType(schema, stringToStructureCoercions())

			expect(result.properties.tags.elysiaMeta).toBe('ArrayString')
		})

		it('should not transform root object', () => {
			const schema = t.Object({
				name: t.String()
			})

			const result = replaceSchemaType(schema, stringToStructureCoercions())

			expect(result.type).toBe('object')
			expect(result.elysiaMeta).toBeUndefined()
		})
	})

	describe('queryCoercions', () => {
		it('should return cached coercions on subsequent calls', () => {
			const first = queryCoercions()
			const second = queryCoercions()

			expect(first).toBe(second)
		})

		it('should transform nested Objects to ObjectString for query params', () => {
			const schema = t.Object({
				filter: t.Object({
					category: t.String(),
					minPrice: t.Number()
				})
			})

			const result = replaceSchemaType(schema, queryCoercions())

			expect(result.properties.filter.elysiaMeta).toBe('ObjectString')
		})

		it('should transform Arrays to ArrayQuery', () => {
			const schema = t.Object({
				ids: t.Array(t.Number())
			})

			const result = replaceSchemaType(schema, queryCoercions())

			// Should have ArrayQuery format
			expect(result.properties.ids.elysiaMeta).toBe('ArrayQuery')
		})

		it('should not transform root for query coercions', () => {
			const schema = t.Object({
				page: t.Number()
			})

			const result = replaceSchemaType(schema, queryCoercions())

			expect(result.type).toBe('object')
			expect(result.elysiaMeta).toBeUndefined()
		})
	})

	describe('coercePrimitiveRoot', () => {
		it('should return cached coercions on subsequent calls', () => {
			const first = coercePrimitiveRoot()
			const second = coercePrimitiveRoot()

			expect(first).toBe(second)
		})

		it('should transform root Number to Numeric', () => {
			const schema = t.Number()
			const result = replaceSchemaType(schema, coercePrimitiveRoot())

			expect(result.type).toBe('string')
			expect(result.pattern).toBeDefined() // Numeric has pattern
		})

		it('should transform root Boolean to BooleanString', () => {
			const schema = t.Boolean()
			const result = replaceSchemaType(schema, coercePrimitiveRoot())

			expect(result.elysiaMeta).toBe('BooleanString')
		})

		it('should only transform at root level', () => {
			const schema = t.Object({
				age: t.Number(),
				active: t.Boolean()
			})

			const result = replaceSchemaType(schema, coercePrimitiveRoot())

			// Nested primitives should NOT be transformed
			expect(result.properties.age.type).toBe('number')
			expect(result.properties.active.type).toBe('boolean')
		})

		it('should not transform String at root', () => {
			const schema = t.String()
			const result = replaceSchemaType(schema, coercePrimitiveRoot())

			expect(result.type).toBe('string')
			expect(result.pattern).toBeUndefined()
		})

		it('should not transform Object at root', () => {
			const schema = t.Object({ name: t.String() })
			const result = replaceSchemaType(schema, coercePrimitiveRoot())

			expect(result.type).toBe('object')
		})
	})

	describe('coerceFormData', () => {
		it('should return cached coercions on subsequent calls', () => {
			const first = coerceFormData()
			const second = coerceFormData()

			expect(first).toBe(second)
		})

		it('should only transform first level Objects', () => {
			const schema = t.Object({
				user: t.Object({
					profile: t.Object({
						bio: t.String()
					})
				})
			})

			const result = replaceSchemaType(schema, coerceFormData())

			// Root should not be transformed
			expect(result.elysiaMeta).toBeUndefined()

			// First level should be transformed
			expect(result.properties.user.elysiaMeta).toBe('ObjectString')

			// Second level should NOT be transformed
			const userObjBranch = result.properties.user.anyOf.find((x: any) => x.type === 'object')
			expect(userObjBranch.properties.profile.type).toBe('object')
			expect(userObjBranch.properties.profile.elysiaMeta).toBeUndefined()
		})

		it('should only transform first level Arrays', () => {
			const schema = t.Object({
				tags: t.Array(
					t.Array(t.String())
				)
			})

			const result = replaceSchemaType(schema, coerceFormData())

			// First level array should be transformed
			expect(result.properties.tags.elysiaMeta).toBe('ArrayString')

			// Nested array should NOT be transformed
			const tagsArrBranch = result.properties.tags.anyOf.find((x: any) => x.type === 'array')
			expect(tagsArrBranch.items.type).toBe('array')
			expect(tagsArrBranch.items.elysiaMeta).toBeUndefined()
		})

		it('should work with mixed nested structures', () => {
			const schema = t.Object({
				file: t.File(),
				data: t.Object({
					items: t.Array(
						t.Object({ name: t.String() })
					)
				})
			})

			const result = replaceSchemaType(schema, coerceFormData())

			// File should remain unchanged
			expect(result.properties.file.type).toBe('string')
			expect(result.properties.file.format).toBe('binary')

			// First level object should be ObjectString
			expect(result.properties.data.elysiaMeta).toBe('ObjectString')

			// Nested array and object should remain plain
			const dataObjBranch = result.properties.data.anyOf.find((x: any) => x.type === 'object')
			expect(dataObjBranch.properties.items.type).toBe('array')
			expect(dataObjBranch.properties.items.elysiaMeta).toBeUndefined()
			expect(dataObjBranch.properties.items.items.type).toBe('object')
			expect(dataObjBranch.properties.items.items.elysiaMeta).toBeUndefined()
		})
	})

	describe('Coercion Combinations', () => {
		it('should apply stringToStructureCoercions and coercePrimitiveRoot together', () => {
			const schema = t.Object({
				age: t.Number(),
				metadata: t.Object({
					score: t.Number()
				})
			})

			const result = replaceSchemaType(schema, [
				...stringToStructureCoercions(),
				...coercePrimitiveRoot()
			])

			// Nested object should be ObjectString
			expect(result.properties.metadata.elysiaMeta).toBe('ObjectString')

			// Root level number should remain (primitiveRoot only affects root schema)
			expect(result.properties.age.type).toBe('number')
		})

		it('should preserve schema metadata through coercion', () => {
			const schema = t.Object({
				count: t.Number({
					minimum: 0,
					maximum: 100,
					default: 10
				})
			})

			const result = replaceSchemaType(schema, stringToStructureCoercions())

			// Metadata should be preserved
			expect(result.properties.count.minimum).toBe(0)
			expect(result.properties.count.maximum).toBe(100)
			expect(result.properties.count.default).toBe(10)
		})
	})

	describe('Performance and Caching', () => {
		it('should cache all coercion functions', () => {
			// Call each function twice
			const str1 = stringToStructureCoercions()
			const str2 = stringToStructureCoercions()
			const query1 = queryCoercions()
			const query2 = queryCoercions()
			const prim1 = coercePrimitiveRoot()
			const prim2 = coercePrimitiveRoot()
			const form1 = coerceFormData()
			const form2 = coerceFormData()

			// All should return same references
			expect(str1).toBe(str2)
			expect(query1).toBe(query2)
			expect(prim1).toBe(prim2)
			expect(form1).toBe(form2)
		})

		it('should have correct number of coercions in each utility', () => {
			expect(stringToStructureCoercions()).toHaveLength(2)
			expect(queryCoercions()).toHaveLength(2)
			expect(coercePrimitiveRoot()).toHaveLength(2)
			expect(coerceFormData()).toHaveLength(2)
		})
	})
})