import { getCookies, setCookie } from "https://deno.land/std@0.184.0/http/cookie.ts"
import { resolve, dirname, fromFileUrl, join } from "https://deno.land/std@0.184.0/path/mod.ts"

const moduleDir = resolve(dirname(fromFileUrl(import.meta.url)))

const port = Number(Deno.args[0] ?? 8000)

const encoder = new TextEncoder()
const decoder = new TextDecoder()
let cwd = Deno.cwd()

const genKey = () => {
  const buf = new Uint8Array(25)
  crypto.getRandomValues(buf)
  // Uint8Array.map doesn't support callbackFn that returns string in Deno
  const parts: string[] = []
  for (const b of buf) parts.push(b.toString(16))
  return parts.join("")
}

const key = genKey()
let sessionId = "to generate"

const tree = async (path: string) => {
  const result = {
    path,
    dirs: <string[]>[],
    files: <string[]>[],
  }
  for await (const f of Deno.readDir(path))
    if (!f.name.startsWith(".") && !f.isSymlink)
      (f.isFile ? result.files : result.dirs).push(f.name)
  return result
}

const readFileOrError = async (path: string) => {
  try {
    return await Deno.readTextFile(path)
  } catch (e) {
    return e.message + "\n" + e.stack
  }
}

const serveHttp = async (conn: Deno.Conn, req: Request) => {
  if ((<Deno.NetAddr>conn.remoteAddr).hostname !== "127.0.0.1")
    return new Response(
      "Only local requests are allowed for security purposes", {status: 403})
  const url = new URL(req.url)
  if (req.method === "GET") {
    if (getCookies(req.headers)["SessionId"] !== sessionId)
      if (url.pathname === "/cwd") return new Response("", {status: 200}); else
        return new Response(
          `<form action="/login" method="post">
    Paste the key from console: <input type="password", name="key" autofocus>
    <input type="submit" value="Log In"></form>`,
          {status: 200, headers: {"content-type": "text/html; charset=utf-8"}},
        )
    if (url.pathname === "/cwd") return new Response(cwd, {status: 200})
    if (url.pathname.startsWith("/open")) return new Response(
      await readFileOrError(url.pathname.slice(5)), {status: 200})
    if (url.pathname.endsWith(".js")) return new Response(
      await Deno.readTextFile(join(moduleDir, url.pathname)), {
        status: 200,
        headers: {"content-type": "application/javascript; charset=utf-8"},
      },
    )
    if (url.pathname !== "/shell.html") Response.redirect("/shell.html", 302)
    return new Response(await Deno.readTextFile(join(moduleDir, "shell.html")), {
      status: 200,
      headers: {"content-type": "text/html; charset=utf-8"},
    })
  }
  if (req.method === "POST") {
    if (url.pathname === "/login") {
      if ((await req.formData()).get("key") !== key)
        return new Response("Key mismatch", {status: 403})
      const response = new Response(
        "", {
          status: 303,
          headers: new Headers({"Location": "/shell.html"})
        }
      )
      setCookie(response.headers, {name: "SessionId", value: sessionId = genKey()})
      return response
    }
    if (getCookies(req.headers)["SessionId"] !== sessionId)
      return Response.json({
        stderr: "Expired session ID, please reload this page to relogin:"})

    const cmd = await req.text()
    try {
      if (cmd === "tree") return Response.json(
        {tree: await tree(url.searchParams.get("path") ?? cwd)})
      const p = new Deno.Command("sh", {
        cwd,
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
      }).spawn()
      const stdinWriter = p.stdin.getWriter()
      await stdinWriter.write(encoder.encode(cmd + ";echo;pwd"))
      await stdinWriter.close()
      const output = await p.output()
      const lines = decoder.decode(output.stdout).trim().split("\n")
      const stdout = lines.slice(0, -1).join("\n")
      cwd = lines[lines.length - 1].trim()

      return Response.json({stdout, stderr: decoder.decode(output.stderr)})
    } catch (e) {
      return Response.json({stderr: e.message + "\n" + e.stack})
    }
  }
  return new Response("Unsupported HTTP method", {status: 404})
}

const serveConn = async (conn: Deno.Conn) => {
  for await (const reqEvent of Deno.serveHttp(conn))
    (async () => reqEvent.respondWith(await serveHttp(conn, reqEvent.request)))()
}

console.log(`Visit http://localhost:${port} in your browser`)
console.log("When prompted, paste the key below:")
console.log(key + "\n")
console.log("%cFor security purposes, DO NOT share the key with anyone else",
  "color: red; font-weight: bold")
for await (const conn of Deno.listen({port})) serveConn(conn)
