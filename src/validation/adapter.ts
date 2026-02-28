/**
 * Schema Validation Adapter
 *
 * Provides unified schema compilation with TypeMap optimization:
 * - TypeBox: Direct compile (fastest)
 * - Valibot: TypeMap → TypeBox compile (3.7x faster than native)
 * - Zod/ArkType: Fallback to Standard Schema native validation
 */

import { Kind, type TSchema } from '@sinclair/typebox'
import { TypeCompiler, type TypeCheck } from '@sinclair/typebox/compiler'

import type { StandardSchemaV1Like } from '../types'

// Lazy load TypeMap to make it optional
let TypeMapTypeBox: ((schema: unknown) => TSchema | undefined) | undefined

/**
 * Try to load TypeMap dynamically
 * Returns undefined if not available
 */
const getTypeMap = (): typeof TypeMapTypeBox => {
	if (TypeMapTypeBox !== undefined) return TypeMapTypeBox

	try {
		// Dynamic import at runtime
		const typemap = require('@sinclair/typemap')
		TypeMapTypeBox = typemap.TypeBox
	} catch {
		// TypeMap not installed - that's fine, we'll use fallback
		TypeMapTypeBox = undefined
	}

	return TypeMapTypeBox
}

/**
 * Check if a schema is a TypeBox schema
 */
export const isTypeBox = (schema: unknown): schema is TSchema =>
	schema !== null && typeof schema === 'object' && Kind in (schema as object)

/**
 * Check if a schema implements Standard Schema
 */
export const isStandardSchema = (schema: unknown): schema is StandardSchemaV1Like =>
	schema !== null &&
	typeof schema === 'object' &&
	'~standard' in (schema as object)

/**
 * Attempt to convert a Standard Schema to TypeBox using TypeMap
 * Returns undefined if conversion fails or TypeMap is not available
 */
export const tryConvertToTypeBox = (schema: unknown): TSchema | undefined => {
	// Already TypeBox - no conversion needed
	if (isTypeBox(schema)) return schema

	// Try TypeMap conversion
	const TypeBox = getTypeMap()
	if (!TypeBox) return undefined

	try {
		const converted = TypeBox(schema)

		// TypeMap returns TNever for unsupported schemas
		if (!converted || converted[Kind] === 'Never') {
			return undefined
		}

		return converted
	} catch {
		// Conversion failed
		return undefined
	}
}

/**
 * Result from toValidator
 */
export type ValidatorResult =
	| { type: 'compiled'; validator: TypeCheck<TSchema> }
	| { type: 'standard'; validate: StandardSchemaV1Like['~standard']['validate'] }

/**
 * Convert any supported schema to a validator
 *
 * Priority:
 * 1. TypeBox schema → TypeCompiler.Compile (fastest)
 * 2. Standard Schema → Try TypeMap conversion → TypeCompiler.Compile
 * 3. Standard Schema → Native ~standard.validate (fallback)
 */
export const toValidator = (schema: unknown): ValidatorResult => {
	// Fast path: already TypeBox
	if (isTypeBox(schema)) {
		return {
			type: 'compiled',
			validator: TypeCompiler.Compile(schema)
		}
	}

	// Try TypeMap conversion for Standard Schema
	const converted = tryConvertToTypeBox(schema)
	if (converted) {
		return {
			type: 'compiled',
			validator: TypeCompiler.Compile(converted)
		}
	}

	// Fallback: use native Standard Schema validation
	if (isStandardSchema(schema)) {
		return {
			type: 'standard',
			validate: schema['~standard'].validate
		}
	}

	throw new Error(
		'Unsupported schema type. Schema must be TypeBox or implement Standard Schema.'
	)
}

/**
 * Check if TypeMap is available
 */
export const hasTypeMap = (): boolean => {
	return getTypeMap() !== undefined
}
