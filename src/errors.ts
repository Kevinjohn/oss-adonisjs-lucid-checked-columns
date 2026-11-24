import { Exception } from '@adonisjs/core/exceptions'

/** Stored JSON is malformed or fails the column's type predicate. */
export class InvalidPersistedJsonException extends Exception {
  static code = 'E_INVALID_PERSISTED_JSON'
  static status = 500

  constructor(
    readonly table: string,
    readonly column: string
  ) {
    super(`Invalid persisted JSON in ${table}.${column}`)
  }
}

/** A value or its JSON encoding fails the column's type predicate before a write. */
export class InvalidJsonColumnValueException extends Exception {
  static code = 'E_INVALID_JSON_COLUMN_VALUE'
  static status = 500

  constructor(
    readonly table: string,
    readonly column: string
  ) {
    super(`Invalid persisted JSON in ${table}.${column}`)
  }
}

/** A value accepted by the column's type predicate has no JSON encoding. */
export class UndefinedJsonColumnValueException extends Exception {
  static code = 'E_UNDEFINED_JSON_COLUMN_VALUE'
  static status = 500

  constructor(
    readonly table: string,
    readonly column: string
  ) {
    super(`Cannot persist undefined JSON in ${table}.${column}`)
  }
}

/** JSON encoding threw while preparing a value for a write. */
export class JsonColumnEncodingException extends Exception {
  static code = 'E_JSON_COLUMN_ENCODING'
  static status = 500

  constructor(
    readonly table: string,
    readonly column: string,
    options?: ErrorOptions
  ) {
    super(`Cannot encode JSON in ${table}.${column}`, { cause: options?.cause })
  }
}

/** A value fails the ISO column's required date or timestamp format. */
export class InvalidIsoColumnValueException extends Exception {
  static code = 'E_INVALID_ISO_COLUMN_VALUE'
  static status = 500

  constructor(
    readonly table: string,
    readonly column: string,
    readonly kind: 'date' | 'timestamp'
  ) {
    super(`Invalid persisted ${kind} in ${table}.${column}`)
  }
}

export const E_INVALID_PERSISTED_JSON = InvalidPersistedJsonException
export const E_INVALID_JSON_COLUMN_VALUE = InvalidJsonColumnValueException
export const E_UNDEFINED_JSON_COLUMN_VALUE = UndefinedJsonColumnValueException
export const E_JSON_COLUMN_ENCODING = JsonColumnEncodingException
export const E_INVALID_ISO_COLUMN_VALUE = InvalidIsoColumnValueException
