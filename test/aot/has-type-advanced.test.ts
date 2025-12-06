import { describe, it, expect } from 'bun:test'
import { Elysia, t } from '../../src'
import { hasType } from '../../src/schema'

describe('hasType - Advanced Cases', () => {
	describe('Import/Ref Schema Handling', () => {
		it('should detect type in Import schemas', () => {
			const app = new Elysia()
				.model('User', t.Object({
					avatar: t.File()
				}))

			const models = app.compile().definitions.type as any
			const userSchema = models.User

			// Check if File type is detected through Import
			expect(hasType('File', userSchema)).toBe(true)
		})

		it('should handle nested Import schemas', () => {
			const app = new Elysia()
				.model('Profile', t.Object({
					documents: t.Files()
				}))

			const models = app.compile().definitions.type as any
			const profileSchema = models.Profile

			expect(hasType('Files', profileSchema)).toBe(true)
		})

		it('should return false for non-existent types in Import', () => {
			const app = new Elysia()
				.model('Basic', t.Object({
					name: t.String()
				}))

			const models = app.compile().definitions.type as any
			const schema = models.Basic

			expect(hasType('File', schema)).toBe(false)
		})
	})

	describe('Composition Type Detection (anyOf, oneOf, allOf)', () => {
		it('should detect type in anyOf branches', () => {
			const schema = t.Union([
				t.String(),
				t.Object({ file: t.File() }),
				t.Number()
			])

			expect(hasType('File', schema)).toBe(true)
		})

		it('should detect type in oneOf branches', () => {
			const schema = {
				oneOf: [
					t.String(),
					t.Object({ upload: t.File() })
				]
			} as any

			expect(hasType('File', schema)).toBe(true)
		})

		it('should detect type in allOf branches', () => {
			const schema = {
				allOf: [
					t.Object({ name: t.String() }),
					t.Object({ avatar: t.File() })
				]
			} as any

			expect(hasType('File', schema)).toBe(true)
		})

		it('should return false if type not in any branch', () => {
			const schema = t.Union([
				t.String(),
				t.Number(),
				t.Boolean()
			])

			expect(hasType('File', schema)).toBe(false)
		})

		it('should detect deeply nested types in composition', () => {
			const schema = t.Union([
				t.String(),
				t.Object({
					nested: t.Union([
						t.Number(),
						t.Object({ file: t.File() })
					])
				})
			])

			expect(hasType('File', schema)).toBe(true)
		})
	})

	describe('Array Type Detection', () => {
		it('should detect File type in Files (array of File)', () => {
			const schema = t.Object({
				images: t.Files()
			})

			expect(hasType('Files', schema)).toBe(true)
		})

		it('should detect type in array items', () => {
			const schema = t.Array(t.File())

			expect(hasType('File', schema)).toBe(true)
		})

		it('should detect type in nested arrays', () => {
			const schema = t.Array(
				t.Array(
					t.Object({ file: t.File() })
				)
			)

			expect(hasType('File', schema)).toBe(true)
		})

		it('should return false for arrays without the type', () => {
			const schema = t.Array(t.String())

			expect(hasType('File', schema)).toBe(false)
		})

		it('should detect Files type specifically', () => {
			const filesSchema = t.Files()
			expect(hasType('Files', filesSchema)).toBe(true)
		})
	})

	describe('Object Property Recursion', () => {
		it('should detect type in deeply nested object properties', () => {
			const schema = t.Object({
				level1: t.Object({
					level2: t.Object({
						level3: t.Object({
							file: t.File()
						})
					})
				})
			})

			expect(hasType('File', schema)).toBe(true)
		})

		it('should detect type across multiple properties', () => {
			const schema = t.Object({
				prop1: t.String(),
				prop2: t.Number(),
				prop3: t.Object({
					nested: t.File()
				})
			})

			expect(hasType('File', schema)).toBe(true)
		})

		it('should return false if type not in any property', () => {
			const schema = t.Object({
				name: t.String(),
				age: t.Number(),
				active: t.Boolean()
			})

			expect(hasType('File', schema)).toBe(false)
		})
	})

	describe('Edge Cases and Error Handling', () => {
		it('should return false for undefined schema', () => {
			expect(hasType('File', undefined as any)).toBe(false)
		})

		it('should return false for null schema', () => {
			expect(hasType('File', null as any)).toBe(false)
		})

		it('should handle schemas without properties', () => {
			const schema = t.Object({})
			expect(hasType('File', schema)).toBe(false)
		})

		it('should handle empty arrays', () => {
			const schema = t.Array(t.Any())
			expect(hasType('File', schema)).toBe(false)
		})

		it('should detect type at root level', () => {
			const schema = t.File()
			expect(hasType('File', schema)).toBe(true)
		})

		it('should handle ObjectString schemas', () => {
			const schema = t.ObjectString({
				file: t.File()
			})

			expect(hasType('File', schema)).toBe(true)
		})

		it('should handle ArrayString schemas', () => {
			const schema = t.ArrayString(t.File())

			expect(hasType('File', schema)).toBe(true)
		})
	})

	describe('Complex Schema Patterns', () => {
		it('should detect type in mixed composition and nesting', () => {
			const schema = t.Object({
				data: t.Union([
					t.String(),
					t.Object({
						uploads: t.Array(
							t.Union([
								t.File(),
								t.String()
							])
						)
					})
				])
			})

			expect(hasType('File', schema)).toBe(true)
		})

		it('should handle schema with optional properties', () => {
			const schema = t.Object({
				name: t.String(),
				avatar: t.Optional(t.File())
			})

			expect(hasType('File', schema)).toBe(true)
		})

		it('should handle schema with nullable properties', () => {
			const schema = t.Object({
				document: t.Nullable(t.File())
			})

			expect(hasType('File', schema)).toBe(true)
		})
	})

	describe('Multiple Type Detection', () => {
		it('should detect multiple different types', () => {
			const schema = t.Object({
				avatar: t.File(),
				documents: t.Files(),
				name: t.String()
			})

			expect(hasType('File', schema)).toBe(true)
			expect(hasType('Files', schema)).toBe(true)
			expect(hasType('String', schema)).toBe(true)
			expect(hasType('Number', schema)).toBe(false)
		})
	})

	describe('Performance and Recursion Limits', () => {
		it('should handle very deep nesting without stack overflow', () => {
			let schema: any = t.String()
			
			// Create deeply nested structure
			for (let i = 0; i < 50; i++) {
				schema = t.Object({ nested: schema })
			}
			
			// Add File at the deepest level
			schema = t.Object({ nested: schema, file: t.File() })

			expect(hasType('File', schema)).toBe(true)
		})

		it('should handle wide object structures', () => {
			const properties: any = {}
			
			// Create object with many properties
			for (let i = 0; i < 100; i++) {
				properties[`prop${i}`] = t.String()
			}
			properties.file = t.File()

			const schema = t.Object(properties)

			expect(hasType('File', schema)).toBe(true)
		})
	})
})