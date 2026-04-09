import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { Storage } from '@google-cloud/storage'

export interface ArtifactStore {
  writeJson(path: string, value: unknown): Promise<void>
  readJson<T>(path: string): Promise<T | null>
  list(prefix: string): Promise<string[]>
}

function normalizeKey(path: string): string {
  return path.replace(/^\/+/, '').replace(/\\/g, '/')
}

function ensureTrailingSlash(value: string): string {
  if (!value) {
    return ''
  }

  return value.endsWith('/') ? value : `${value}/`
}

class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly rootDir: string) {}

  private resolvePath(path: string): string {
    return resolve(this.rootDir, normalizeKey(path))
  }

  async writeJson(path: string, value: unknown): Promise<void> {
    const absolutePath = this.resolvePath(path)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }

  async readJson<T>(path: string): Promise<T | null> {
    const absolutePath = this.resolvePath(path)

    if (!existsSync(absolutePath)) {
      return null
    }

    const contents = await readFile(absolutePath, 'utf8')
    return JSON.parse(contents) as T
  }

  async list(prefix: string): Promise<string[]> {
    const root = this.resolvePath(prefix)
    if (!existsSync(root)) {
      return []
    }

    const result: string[] = []
    const walk = async (current: string): Promise<void> => {
      const entries = await import('node:fs/promises').then(fs =>
        fs.readdir(current, { withFileTypes: true })
      )

      for (const entry of entries) {
        const entryPath = `${current}${sep}${entry.name}`
        if (entry.isDirectory()) {
          await walk(entryPath)
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          const relative = entryPath.slice(this.rootDir.length + 1).replace(/\\/g, '/')
          result.push(relative)
        }
      }
    }

    await walk(root)
    return result.sort()
  }
}

class GcsArtifactStore implements ArtifactStore {
  private readonly storage = new Storage()

  constructor(private readonly bucketName: string) {}

  private bucket() {
    return this.storage.bucket(this.bucketName)
  }

  async writeJson(path: string, value: unknown): Promise<void> {
    await this.bucket().file(normalizeKey(path)).save(
      `${JSON.stringify(value, null, 2)}\n`,
      {
        resumable: false,
        contentType: 'application/json; charset=utf-8'
      }
    )
  }

  async readJson<T>(path: string): Promise<T | null> {
    const file = this.bucket().file(normalizeKey(path))
    const [exists] = await file.exists()

    if (!exists) {
      return null
    }

    const [contents] = await file.download()
    return JSON.parse(contents.toString('utf8')) as T
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = normalizeKey(prefix)
    const [files] = await this.bucket().getFiles({
      prefix: normalized ? ensureTrailingSlash(normalized) : undefined
    })

    return files.map(file => file.name).sort()
  }
}

export function createArtifactStore(bucketName?: string): ArtifactStore {
  const normalized = bucketName?.trim()
  if (normalized) {
    return new GcsArtifactStore(normalized)
  }

  return new LocalArtifactStore(resolve(process.cwd(), 'data', 'artifacts'))
}
