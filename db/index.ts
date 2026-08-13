import { drizzle } from 'drizzle-orm/netlify-db'
import * as schema from './schema.js'

let database: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getDb() {
  database ??= drizzle({ schema })
  return database
}
