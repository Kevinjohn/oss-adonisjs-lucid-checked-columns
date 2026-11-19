import type { ChildProcess } from 'node:child_process'
import { readFile } from 'node:fs/promises'

/** Collect a child's stdout and stderr as it runs. */
type ChildOutput = {
  completion: Promise<{ code: number | null; signal: NodeJS.Signals | null; text: string }>
}

export async function readChildOutput(child: ChildProcess): Promise<ChildOutput> {
  let output = ''
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  const completion = new Promise<Awaited<ChildOutput['completion']>>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal, text: output }))
  })
  return { completion }
}

/** Return the completion captured when output collection began. */
export async function collectExit(
  output: ChildOutput
): Promise<{ code: number | null; signal: NodeJS.Signals | null; text: string }> {
  return output.completion
}

/** Whether a process is still running; a zombie counts as gone. */
export async function isAlive(pid: number): Promise<boolean> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8')
    const state = stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3)
    return state !== 'Z'
  } catch {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== 'ESRCH'
    }
  }
}

/** Wait for a complete positive PID before using it for process liveness or signals. */
export async function waitForPid(
  filePath: string,
  timeoutMs = 5000,
  completion?: ChildOutput['completion']
): Promise<number> {
  let stopped = false
  const poll = async (): Promise<number> => {
    const deadline = Date.now() + timeoutMs
    while (!stopped && Date.now() < deadline) {
      try {
        const contents = await readFile(filePath, 'utf8')
        if (/^[1-9]\d*\n$/.test(contents)) {
          const pid = Number(contents)
          if (Number.isSafeInteger(pid)) return pid
          throw new Error(`Invalid PID record in ${filePath}: ${JSON.stringify(contents)}`)
        } else if (contents !== '' && !/^[1-9]\d*$/.test(contents)) {
          throw new Error(`Invalid PID record in ${filePath}: ${JSON.stringify(contents)}`)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error(`Timed out waiting for a complete PID in ${filePath}`)
  }
  try {
    return await Promise.race([
      poll(),
      ...(completion
        ? [
            completion.then((): never => {
              throw new Error(`Child exited before publishing a PID in ${filePath}`)
            }),
          ]
        : []),
    ])
  } finally {
    stopped = true
  }
}

/** Poll for a marker file written by a child. */
export async function waitForFile(filePath: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await readFile(filePath)
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for ${filePath}`)
}
