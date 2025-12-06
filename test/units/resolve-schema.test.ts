import { describe, it, expect } from 'bun:test'
import { Elysia, t } from '../../src'
import { resolveSchema } from '../../src/schema'

describe('resolveSchema', () => {
	describe('Basic Resolution', () => {
		it('should return undefined for undefined schema', () => {
			expect(resolveSchema(undefined)).toBeUndefined()
		})

		it('should return the schema itself if not a string', () => {
			const schema = t.String()
			expect(resolveSchema(schema)).toBe(schema)
		})

		it('should resolve schema from models by string reference', () => {
			const userModel = t.Object({
				id: t.Number(),
				name: t.String()
			})
			const models = {
				User: userModel
			}

			const result = resolveSchema('User', models)
			expect(result).toBe(userModel)
		})

		it('should return undefined if string reference not found in models', () => {
			const models = {
				User: t.Object({ id: t.Number() })
			}

			expect(resolveSchema('NonExistent', models)).toBeUndefined()
		})
	})

	describe('Module Resolution (Higher Priority)', () => {
		it('should resolve from modules if available', () => {
			const app = new Elysia()
				.model('Product', t.Object({
					sku: t.String(),
					price: t.Number()
				}))

			const modules = app.compile().modules

			const schema = t.Object({
				id: t.Number()
			})
			const models = {
				Product: schema // Different schema in models
			}

			// Modules should have higher priority than models
			const result = resolveSchema('Product', models, modules)
			
			// Should resolve from modules, not models
			expect(result).toBeDefined()
			if (result && 'properties' in result) {
				expect(result.properties).toHaveProperty('sku')
				expect(result.properties).toHaveProperty('price')
			}
		})

		it('should fall back to models if not in modules', () => {
			const app = new Elysia()
			const modules = app.compile().modules

			const userSchema = t.Object({
				name: t.String()
			})
			const models = {
				User: userSchema
			}

			const result = resolveSchema('User', models, modules)
			expect(result).toBe(userSchema)
		})

		it('should return undefined if not in modules or models', () => {
			const app = new Elysia()
			const modules = app.compile().modules
			const models = {}

			expect(resolveSchema('Unknown', models, modules)).toBeUndefined()
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty models object', () => {
			expect(resolveSchema('User', {})).toBeUndefined()
		})

		it('should handle null models parameter', () => {
			expect(resolveSchema('User', undefined)).toBeUndefined()
		})

		it('should handle complex schema objects', () => {
			const complexSchema = t.Union([
				t.String(),
				t.Object({
					nested: t.Array(t.Number())
				})
			])

			expect(resolveSchema(complexSchema)).toBe(complexSchema)
		})

		it('should handle schema with numeric string key', () => {
			const models = {
				'123': t.String()
			}

			const result = resolveSchema('123', models)
			expect(result).toBeDefined()
			expect(result?.type).toBe('string')
		})

		it('should handle schema with special characters in key', () => {
			const schema = t.Number()
			const models = {
				'user-profile': schema,
				'user_data': schema
			}

			expect(resolveSchema('user-profile', models)).toBe(schema)
			expect(resolveSchema('user_data', models)).toBe(schema)
		})
	})

	describe('Integration with Elysia App', () => {
		it('should work with app.model registration', () => {
			const app = new Elysia()
				.model({
					User: t.Object({
						id: t.Number(),
						email: t.String({ format: 'email' })
					}),
					Post: t.Object({
						title: t.String(),
						content: t.String()
					})
				})

			const models = app.compile().definitions.type as any

			const userSchema = resolveSchema('User', models)
			const postSchema = resolveSchema('Post', models)

			expect(userSchema).toBeDefined()
			expect(postSchema).toBeDefined()

			if (userSchema && 'properties' in userSchema) {
				expect(userSchema.properties).toHaveProperty('id')
				expect(userSchema.properties).toHaveProperty('email')
			}

			if (postSchema && 'properties' in postSchema) {
				expect(postSchema.properties).toHaveProperty('title')
				expect(postSchema.properties).toHaveProperty('content')
			}
		})
	})

	describe('Standard Schema Support', () => {
		it('should resolve standard schema types', () => {
			const standardSchema = {
				'~standard': 1,
				'~vendor': 'custom',
				validate: (value: unknown) => ({ value })
			}

			const models = {
				CustomSchema: standardSchema
			}

			const result = resolveSchema('CustomSchema', models)
			expect(result).toBe(standardSchema)
		})
	})
})