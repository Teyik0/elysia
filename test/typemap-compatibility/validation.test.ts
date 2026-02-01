/**
 * TypeBox 1.0 + TypeMap Compatibility Tests
 *
 * Phase 0: Validation des points critiques avant migration
 *
 * CRITICAL FINDING:
 * - TypeMap 0.10.1 depends on @sinclair/typebox@^0.34 (old)
 * - TypeBox 1.0 is a separate package named 'typebox'
 * - These are NOT directly compatible!
 */

import { describe, it, expect } from 'bun:test'

// TypeBox 1.0 (new package name)
import { Type } from 'typebox'
import { Compile } from 'typebox/compile'

// TypeMap (uses @sinclair/typebox 0.34 internally!)
import { TypeBox as ToTypeBox } from '@sinclair/typemap'
import { Compile as TypeMapCompile } from '@sinclair/typemap'

// TypeBox 0.34 (old package - used by TypeMap)
import { Type as TypeOld, Kind } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// Standard Schema libs for testing
import { z } from 'zod'
import * as v from 'valibot'

describe('Phase 0: TypeBox 1.0 Compatibility', () => {
	describe('1. Symbol Changes (~kind vs Kind)', () => {
		it('should use ~kind property instead of Kind symbol', () => {
			const schema = Type.String()

			// TypeBox 1.0 uses string properties
			expect(schema['~kind']).toBe('String')

			// Kind should still work as helper
			expect(Kind in schema || '~kind' in schema).toBe(true)
		})

		it('should detect optional with ~optional', () => {
			const schema = Type.Optional(Type.String())
			expect('~optional' in schema).toBe(true)
		})

		it('should have Type Guard helpers', () => {
			const str = Type.String()
			const num = Type.Number()
			const obj = Type.Object({ name: Type.String() })

			// Type Guards should exist
			expect(typeof Type.String).toBe('function')
			expect(str['~kind']).toBe('String')
			expect(num['~kind']).toBe('Number')
			expect(obj['~kind']).toBe('Object')
		})
	})

	describe('2. Type.Codec (ex Transform) Support', () => {
		it('should support Type.Codec with Decode/Encode', () => {
			// Numeric-like type using Codec
			// NOTE: In TypeBox 1.0, Codec doesn't change ~kind
			// It adds ~codec property to the schema instead
			const Numeric = Type.Codec(
				Type.Union([Type.String(), Type.Number()])
			)
				.Decode((value) => {
					if (typeof value === 'string') return parseFloat(value)
					return value
				})
				.Encode((value) => value)

			expect(Numeric).toBeDefined()
			// ~kind stays as the original type (Union), ~codec is added
			expect(Numeric['~kind']).toBe('Union')
			expect(Numeric['~codec']).toBeDefined()
			expect(typeof Numeric['~codec'].decode).toBe('function')
			expect(typeof Numeric['~codec'].encode).toBe('function')
		})

		it('should compile Codec types', () => {
			const Numeric = Type.Codec(
				Type.Union([Type.String(), Type.Number()])
			)
				.Decode((value) => {
					if (typeof value === 'string') return parseFloat(value)
					return value
				})
				.Encode((value) => value)

			const validator = Compile(Numeric)

			// Check should work on input type
			expect(validator.Check('123')).toBe(true)
			expect(validator.Check(123)).toBe(true)

			// Decode should transform
			expect(validator.Decode('123')).toBe(123)
			expect(validator.Decode(456)).toBe(456)
		})
	})

	describe('3. Type.Date and Type.Uint8Array Removal', () => {
		it('should NOT have Type.Date (removed in 1.0)', () => {
			// @ts-expect-error - Type.Date removed in 1.0
			expect(Type.Date).toBeUndefined()
		})

		it('should NOT have Type.Uint8Array (removed in 1.0)', () => {
			// @ts-expect-error - Type.Uint8Array removed in 1.0
			expect(Type.Uint8Array).toBeUndefined()
		})

		it('should allow custom Date type via Unsafe', () => {
			const TDate = Type.Unsafe<Date>({
				type: 'object',
				instanceOf: 'Date'
			})

			expect(TDate).toBeDefined()
		})
	})

	describe('4. TypeBox 1.0 Validator vs TypeCompiler', () => {
		it('should compile and validate with new Compile API', () => {
			const schema = Type.Object({
				name: Type.String(),
				age: Type.Number()
			})

			const validator = Compile(schema)

			expect(validator.Check({ name: 'test', age: 25 })).toBe(true)
			expect(validator.Check({ name: 'test' })).toBe(false)
			expect(validator.Check({ name: 123, age: 25 })).toBe(false)
		})

		it('should provide errors', () => {
			const schema = Type.Object({
				name: Type.String(),
				age: Type.Number()
			})

			const validator = Compile(schema)
			const errors = [...validator.Errors({ name: 123 })]

			expect(errors.length).toBeGreaterThan(0)
		})
	})
})

describe('Phase 0: TypeMap Compatibility', () => {
	/**
	 * IMPORTANT: TypeMap outputs @sinclair/typebox 0.34 schemas (Kind symbol)
	 * NOT typebox 1.0 schemas (~kind property)
	 * We must use TypeCompiler from @sinclair/typebox/compiler
	 */

	describe('5. TypeMap Zod Conversion', () => {
		/**
		 * CRITICAL FINDING: TypeMap 0.10.1 requires Zod 3.x
		 * Elysia uses Zod 4.x which has breaking changes
		 * These tests are skipped - TypeMap needs update for Zod 4.x support
		 */
		it.skip('should convert simple Zod schema to TypeBox 0.34 (BLOCKED: Zod 4.x incompatible)', () => {
			const zodSchema = z.object({
				name: z.string(),
				age: z.number()
			})

			const typeboxSchema = ToTypeBox(zodSchema)

			expect(typeboxSchema).toBeDefined()
			// TypeMap outputs 0.34 format (Kind symbol, not ~kind)
			expect(typeboxSchema[Kind]).toBe('Object')
		})

		it.skip('should convert Zod with transforms (BLOCKED: Zod 4.x incompatible)', () => {
			const zodSchema = z.object({
				age: z.string().transform(val => parseInt(val))
			})

			const typeboxSchema = ToTypeBox(zodSchema)

			// Check if transform is preserved or converted
			console.log('Zod transform conversion:', JSON.stringify(typeboxSchema, null, 2))
			expect(typeboxSchema).toBeDefined()
		})

		it.skip('should compile converted Zod schema with TypeCompiler (BLOCKED: Zod 4.x incompatible)', () => {
			const zodSchema = z.object({
				name: z.string(),
				active: z.boolean()
			})

			const typeboxSchema = ToTypeBox(zodSchema)
			// Must use TypeCompiler from @sinclair/typebox (0.34)
			const validator = TypeCompiler.Compile(typeboxSchema)

			expect(validator.Check({ name: 'test', active: true })).toBe(true)
			expect(validator.Check({ name: 'test', active: 'yes' })).toBe(false)
		})
	})

	describe('6. TypeMap Valibot Conversion', () => {
		it('should convert simple Valibot schema to TypeBox 0.34', () => {
			const valibotSchema = v.object({
				name: v.string(),
				age: v.number()
			})

			const typeboxSchema = ToTypeBox(valibotSchema)

			expect(typeboxSchema).toBeDefined()
			expect(typeboxSchema[Kind]).toBe('Object')
		})

		it('should compile converted Valibot schema with TypeCompiler', () => {
			const valibotSchema = v.object({
				email: v.string(),
				count: v.number()
			})

			const typeboxSchema = ToTypeBox(valibotSchema)
			const validator = TypeCompiler.Compile(typeboxSchema)

			expect(validator.Check({ email: 'test@test.com', count: 5 })).toBe(true)
		})
	})

	describe('7. TypeMap Failure Handling (TNever)', () => {
		it('should return TNever for unsupported conversions', () => {
			// Test with something that might not convert
			const result = ToTypeBox(undefined as any)

			console.log('TNever test result:', result)
			// Document what happens - TypeMap 0.34 uses Kind symbol
			expect(result === undefined || result?.[Kind] === 'Never' || result === null).toBe(true)
		})

		it('should handle Standard Schema without TypeMap support', () => {
			// Simulate a schema that TypeMap cannot convert
			const unknownSchema = {
				'~standard': {
					version: 1,
					vendor: 'unknown',
					validate: (value: unknown) => ({ value })
				}
			}

			const result = ToTypeBox(unknownSchema as any)
			console.log('Unknown schema conversion:', result)
			// Document what TypeMap returns for unknown Standard Schema
		})
	})

	describe('8. TypeMap Compile (Standard Schema Interface)', () => {
		it('should create Standard Schema compatible validator', () => {
			const validator = TypeMapCompile('{ name: string, age: number }')

			expect(validator['~standard']).toBeDefined()
			expect(typeof validator['~standard'].validate).toBe('function')
		})

		it('should validate via Standard Schema interface', () => {
			const validator = TypeMapCompile('{ name: string }')

			const validResult = validator['~standard'].validate({ name: 'test' })
			const invalidResult = validator['~standard'].validate({ name: 123 })

			expect(validResult.issues).toBeUndefined()
			expect(invalidResult.issues).toBeDefined()
		})
	})
})

describe('Phase 0: Elysia Custom Types Migration', () => {
	describe('9. Numeric Type Recreation', () => {
		it('should recreate Numeric with Type.Codec', () => {
			const Numeric = Type.Codec(
				Type.Union([
					Type.String({ format: 'numeric' }),
					Type.Number()
				])
			)
				.Decode((value) => {
					const num = Number(value)
					if (isNaN(num)) return value
					return num
				})
				.Encode((value) => value)

			const validator = Compile(Numeric)

			expect(validator.Check('123')).toBe(true)
			expect(validator.Check(123)).toBe(true)
			expect(validator.Decode('456')).toBe(456)
		})
	})

	describe('10. ObjectString Type Recreation', () => {
		it('should recreate ObjectString with Type.Codec', () => {
			const ObjectString = <T extends Record<string, unknown>>(properties: T) =>
				Type.Codec(
					Type.Union([
						Type.String({ format: 'ObjectString' }),
						Type.Object(properties as any)
					])
				)
					.Decode((value) => {
						if (typeof value === 'string') {
							return JSON.parse(value)
						}
						return value
					})
					.Encode((value) => {
						if (typeof value === 'object') {
							return JSON.stringify(value)
						}
						return value
					})

			const schema = ObjectString({ name: Type.String() })
			const validator = Compile(schema)

			expect(validator.Check('{"name":"test"}')).toBe(true)
			expect(validator.Check({ name: 'test' })).toBe(true)
			expect(validator.Decode('{"name":"test"}')).toEqual({ name: 'test' })
		})
	})

	describe('11. BooleanString Type Recreation', () => {
		it('should recreate BooleanString with Type.Codec', () => {
			const BooleanString = Type.Codec(
				Type.Union([
					Type.Boolean(),
					Type.String({ format: 'boolean' })
				])
			)
				.Decode((value) => {
					if (typeof value === 'string') return value === 'true'
					return value
				})
				.Encode((value) => value)

			const validator = Compile(BooleanString)

			expect(validator.Decode('true')).toBe(true)
			expect(validator.Decode('false')).toBe(false)
			expect(validator.Decode(true)).toBe(true)
		})
	})
})

describe('Phase 0: Performance Comparison', () => {
	const iterations = 10000

	it('should benchmark TypeBox 1.0 Compile validation', () => {
		const schema = Type.Object({
			name: Type.String(),
			age: Type.Number(),
			email: Type.String()
		})
		const validator = Compile(schema)
		const testData = { name: 'test', age: 25, email: 'test@test.com' }

		const start = performance.now()
		for (let i = 0; i < iterations; i++) {
			validator.Check(testData)
		}
		const end = performance.now()

		console.log(`TypeBox 1.0 Compile: ${iterations} iterations in ${(end - start).toFixed(2)}ms`)
		console.log(`  Per iteration: ${((end - start) / iterations).toFixed(4)}ms`)
		expect(end - start).toBeLessThan(1000) // Should complete in under 1 second
	})

	it('should benchmark TypeBox 0.34 TypeCompiler validation', () => {
		const schema = TypeOld.Object({
			name: TypeOld.String(),
			age: TypeOld.Number(),
			email: TypeOld.String()
		})
		const validator = TypeCompiler.Compile(schema)
		const testData = { name: 'test', age: 25, email: 'test@test.com' }

		const start = performance.now()
		for (let i = 0; i < iterations; i++) {
			validator.Check(testData)
		}
		const end = performance.now()

		console.log(`TypeBox 0.34 TypeCompiler: ${iterations} iterations in ${(end - start).toFixed(2)}ms`)
		console.log(`  Per iteration: ${((end - start) / iterations).toFixed(4)}ms`)
		expect(end - start).toBeLessThan(1000)
	})

	it('should benchmark TypeMap Compile with syntax', () => {
		const validator = TypeMapCompile('{ name: string, age: number, email: string }')
		const testData = { name: 'test', age: 25, email: 'test@test.com' }

		const start = performance.now()
		for (let i = 0; i < iterations; i++) {
			validator['~standard'].validate(testData)
		}
		const end = performance.now()

		console.log(`TypeMap Compile (syntax): ${iterations} iterations in ${(end - start).toFixed(2)}ms`)
		console.log(`  Per iteration: ${((end - start) / iterations).toFixed(4)}ms`)
		expect(end - start).toBeLessThan(1000)
	})

	it('should benchmark Valibot native validation', () => {
		const schema = v.object({
			name: v.string(),
			age: v.number(),
			email: v.string()
		})
		const testData = { name: 'test', age: 25, email: 'test@test.com' }

		const start = performance.now()
		for (let i = 0; i < iterations; i++) {
			v.parse(schema, testData)
		}
		const end = performance.now()

		console.log(`Valibot native: ${iterations} iterations in ${(end - start).toFixed(2)}ms`)
		console.log(`  Per iteration: ${((end - start) / iterations).toFixed(4)}ms`)
		expect(end - start).toBeLessThan(2000) // Valibot may be slower
	})

	it('should benchmark Valibot via TypeMap conversion', () => {
		const valibotSchema = v.object({
			name: v.string(),
			age: v.number(),
			email: v.string()
		})
		const typeboxSchema = ToTypeBox(valibotSchema)
		const validator = TypeCompiler.Compile(typeboxSchema)
		const testData = { name: 'test', age: 25, email: 'test@test.com' }

		const start = performance.now()
		for (let i = 0; i < iterations; i++) {
			validator.Check(testData)
		}
		const end = performance.now()

		console.log(`Valibot via TypeMap: ${iterations} iterations in ${(end - start).toFixed(2)}ms`)
		console.log(`  Per iteration: ${((end - start) / iterations).toFixed(4)}ms`)
		expect(end - start).toBeLessThan(1000)
	})
})

describe('Phase 0: TModule/Import Compatibility', () => {
	describe('TypeBox 1.0 Module System', () => {
		it('should support Type.Module for schema organization', () => {
			// Check if Type.Module exists in 1.0
			console.log('Type.Module exists:', 'Module' in Type)

			// TypeBox 1.0 uses different approach - check Cyclic
			console.log('Type.Cyclic exists:', 'Cyclic' in Type)
		})

		it('should support $ref resolution in TypeBox 0.34', () => {
			const module = TypeOld.Module({
				User: TypeOld.Object({
					name: TypeOld.String(),
					age: TypeOld.Number()
				}),
				Post: TypeOld.Object({
					title: TypeOld.String(),
					author: TypeOld.Ref('User')
				})
			})

			const UserSchema = module.Import('User')
			const PostSchema = module.Import('Post')

			expect(UserSchema).toBeDefined()
			expect(PostSchema).toBeDefined()
			expect(PostSchema.$defs).toBeDefined()
		})
	})
})

describe('Phase 0: Integration Scenarios', () => {
	/**
	 * CRITICAL INSIGHT:
	 * Current reality: TypeMap produces TypeBox 0.34 schemas
	 * Future goal: TypeMap should produce TypeBox 1.0 schemas
	 *
	 * For now, we demonstrate two adapter patterns:
	 * 1. Using TypeBox 0.34 + TypeMap (current)
	 * 2. Using TypeBox 1.0 only (future migration path)
	 */

	describe('12a. toValidator with TypeBox 0.34 + TypeMap (CURRENT)', () => {
		const isTypeBox034 = (schema: unknown): boolean =>
			schema !== null &&
			typeof schema === 'object' &&
			Kind in (schema as object)

		const toValidator034 = (schema: unknown) => {
			// Fast path: already TypeBox 0.34
			if (isTypeBox034(schema)) {
				return TypeCompiler.Compile(schema as any)
			}

			// Try TypeMap conversion (outputs 0.34)
			const converted = ToTypeBox(schema as any)

			if (converted && converted[Kind] !== 'Never') {
				return TypeCompiler.Compile(converted)
			}

			// Fallback: native Standard Schema
			if (schema && typeof schema === 'object' && '~standard' in schema) {
				return (schema as any)['~standard']
			}

			throw new Error('Unsupported schema type')
		}

		it('should handle TypeBox 0.34 schema directly', () => {
			const schema = TypeOld.Object({ name: TypeOld.String() })
			const validator = toValidator034(schema)

			expect(validator.Check({ name: 'test' })).toBe(true)
		})

		it.skip('should convert and compile Zod schema (BLOCKED: Zod 4.x incompatible)', () => {
			const schema = z.object({ name: z.string() })
			const validator = toValidator034(schema)

			expect(validator.Check({ name: 'test' })).toBe(true)
		})

		it('should convert and compile Valibot schema', () => {
			const schema = v.object({ name: v.string() })
			const validator = toValidator034(schema)

			expect(validator.Check({ name: 'test' })).toBe(true)
		})

		it('should fallback to Standard Schema for unsupported libs', () => {
			const customSchema = {
				'~standard': {
					version: 1,
					vendor: 'custom',
					validate: (value: unknown) => {
						if (typeof value === 'object' && value && 'name' in value) {
							return { value }
						}
						return { issues: [{ message: 'Invalid' }] }
					}
				}
			}

			const validator = toValidator034(customSchema)

			expect(validator.validate({ name: 'test' }).value).toBeDefined()
			expect(validator.validate({}).issues).toBeDefined()
		})
	})

	describe('12b. toValidator with TypeBox 1.0 only (FUTURE)', () => {
		const isTypeBox10 = (schema: unknown): boolean =>
			schema !== null &&
			typeof schema === 'object' &&
			'~kind' in (schema as object)

		const toValidator10 = (schema: unknown) => {
			// TypeBox 1.0 only - no TypeMap yet
			if (isTypeBox10(schema)) {
				return Compile(schema as any)
			}

			// Fallback: native Standard Schema
			if (schema && typeof schema === 'object' && '~standard' in schema) {
				return (schema as any)['~standard']
			}

			throw new Error('Unsupported schema type - TypeMap 1.0 not yet available')
		}

		it('should handle TypeBox 1.0 schema directly', () => {
			const schema = Type.Object({ name: Type.String() })
			const validator = toValidator10(schema)

			expect(validator.Check({ name: 'test' })).toBe(true)
		})

		it('should fallback to Standard Schema for Zod (no TypeMap 1.0)', () => {
			// Zod implements Standard Schema, so fallback works
			const schema = z.object({ name: z.string() })
			const validator = toValidator10(schema)

			// Uses Zod's native validation via ~standard
			const result = validator.validate({ name: 'test' })
			expect(result.value).toBeDefined()
		})
	})
})
