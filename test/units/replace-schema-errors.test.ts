import { describe, it, expect } from 'bun:test'
import { t } from '../../src'
import { replaceSchemaTypeFromManyOptions as replaceSchemaType } from '../../src/replace-schema'

describe('Replace Schema Type - Error Conditions', () => {
	describe('Conflicting Options Validation', () => {
		it('should throw error when both rootOnly and excludeRoot are set', () => {
			expect(() => {
				replaceSchemaType(t.Object({ name: t.String() }), {
					from: t.Object({}),
					to: (s) => t.ObjectString(s.properties || {}),
					rootOnly: true,
					excludeRoot: true
				})
			}).toThrow("Can't set both rootOnly and excludeRoot")
		})

		it('should throw error when both rootOnly and onlyFirst are set', () => {
			expect(() => {
				replaceSchemaType(t.Object({ name: t.String() }), {
					from: t.Object({}),
					to: (s) => t.ObjectString(s.properties || {}),
					rootOnly: true,
					onlyFirst: 'object'
				})
			}).toThrow("Can't set both rootOnly and onlyFirst")
		})

		it('should throw error when both rootOnly and untilObjectFound are set', () => {
			expect(() => {
				replaceSchemaType(t.Object({ name: t.String() }), {
					from: t.Object({}),
					to: (s) => t.ObjectString(s.properties || {}),
					rootOnly: true,
					untilObjectFound: true
				})
			}).toThrow("Can't set both rootOnly and untilObjectFound")
		})
	})

	describe('Valid Option Combinations', () => {
		it('should allow excludeRoot with onlyFirst', () => {
			expect(() => {
				replaceSchemaType(t.Object({ nested: t.Object({}) }), {
					from: t.Object({}),
					to: (s) => t.ObjectString(s.properties || {}),
					excludeRoot: true,
					onlyFirst: 'object'
				})
			}).not.toThrow()
		})

		it('should allow excludeRoot with untilObjectFound', () => {
			expect(() => {
				replaceSchemaType(t.Object({ nested: t.Object({}) }), {
					from: t.Object({}),
					to: (s) => t.ObjectString(s.properties || {}),
					excludeRoot: true,
					untilObjectFound: true
				})
			}).not.toThrow()
		})

		it('should allow onlyFirst with untilObjectFound', () => {
			expect(() => {
				replaceSchemaType(t.Object({ nested: t.Object({}) }), {
					from: t.Object({}),
					to: (s) => t.ObjectString(s.properties || {}),
					onlyFirst: 'object',
					untilObjectFound: true
				})
			}).not.toThrow()
		})
	})

	describe('Edge Cases in Transformation', () => {
		it('should handle null return from to function', () => {
			const result = replaceSchemaType(t.String(), {
				from: t.String(),
				to: () => null as any
			})

			// Should return null as specified by the function
			expect(result).toBeNull()
		})

		it('should handle undefined schema gracefully', () => {
			const result = replaceSchemaType(undefined as any, {
				from: t.String(),
				to: () => t.Number()
			})

			expect(result).toBeUndefined()
		})

		it('should handle schema without Kind property', () => {
			const plainSchema = { type: 'string' } as any

			const result = replaceSchemaType(plainSchema, {
				from: t.String(),
				to: () => t.Number()
			})

			// Should return unchanged since it doesn't match
			expect(result).toEqual(plainSchema)
		})

		it('should handle empty object schema', () => {
			const result = replaceSchemaType(t.Object({}), {
				from: t.String(),
				to: () => t.Number()
			})

			// Should not transform since there are no matching properties
			expect(result.type).toBe('object')
		})

		it('should handle circular references safely', () => {
			const schema: any = t.Object({
				name: t.String()
			})
			
			// Create circular reference
			schema.properties.self = schema

			// Should not cause infinite loop
			const result = replaceSchemaType(schema, {
				from: t.String(),
				to: () => t.Number()
			})

			expect(result).toBeDefined()
		})
	})

	describe('untilObjectFound Option Behavior', () => {
		it('should stop at first nested object when untilObjectFound is true', () => {
			const result = replaceSchemaType(
				t.Object({
					data: t.Object({
						nested: t.Object({
							deep: t.String()
						})
					})
				}),
				{
					from: t.String(),
					to: () => t.Number(),
					untilObjectFound: true
				}
			)

			// Root should be transformed
			expect(result.type).toBe('object')
			
			// First nested object should stop traversal
			expect(result.properties.data.type).toBe('object')
			
			// Deeper nested values should NOT be transformed
			expect(result.properties.data.properties.nested.properties.deep.type).toBe('string')
		})

		it('should not apply untilObjectFound at root level', () => {
			const result = replaceSchemaType(
				t.Object({
					value: t.String()
				}),
				{
					from: t.String(),
					to: () => t.Number(),
					untilObjectFound: true
				}
			)

			// String at root level properties should still be transformed
			expect(result.properties.value.type).toBe('number')
		})
	})

	describe('onlyFirst with Different Types', () => {
		it('should handle onlyFirst with array type', () => {
			const result = replaceSchemaType(
				t.Object({
					arr1: t.Array(t.Array(t.String())),
					arr2: t.Array(t.String())
				}),
				{
					from: t.Array(t.Any()),
					to: (s) => t.ArrayString(s.items || t.Any()),
					onlyFirst: 'array',
					excludeRoot: true
				}
			)

			// First level arrays should be transformed
			expect(result.properties.arr1.elysiaMeta).toBe('ArrayString')
			expect(result.properties.arr2.elysiaMeta).toBe('ArrayString')

			// Nested arrays should not be transformed
			const arr1Branch = result.properties.arr1.anyOf.find((x: any) => x.type === 'array')
			expect(arr1Branch.items.type).toBe('array')
			expect(arr1Branch.items.elysiaMeta).toBeUndefined()
		})

		it('should handle onlyFirst with custom type string', () => {
			const result = replaceSchemaType(
				t.Object({
					str: t.String(),
					nested: t.Object({ str: t.String() })
				}),
				{
					from: t.String(),
					to: () => t.Number(),
					onlyFirst: 'string' as any
				}
			)

			// Root level strings should be transformed
			expect(result.properties.str.type).toBe('number')
			
			// But nested strings should not (stopped at first)
			expect(result.properties.nested.properties.str.type).toBe('string')
		})
	})
})