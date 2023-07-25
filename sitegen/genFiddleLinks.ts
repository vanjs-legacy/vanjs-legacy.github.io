import van from "./mini-van.js"
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"
import { join } from "https://deno.land/std@0.184.0/path/mod.ts"

const jsFiddleRoot = "/Users/xintao/org/vanjs-legacy.github.io/jsfiddle"
const ghPath = "vanjs-legacy/vanjs-legacy.github.io/tree/master/jsfiddle"

const mkdirIfNotExist = (dir: string) => {
  try {
    Deno.mkdirSync(dir, {recursive: true})
  } catch (e) {
    if (!(e instanceof Deno.errors.AlreadyExists)) throw e
  }
}

const findCode = (dom: Element) => {
  while (!dom.firstElementChild?.matches("code[class^=language-]"))
    dom = dom.previousElementSibling!
  return dom.querySelector("code")!.innerText
}

const extractCss = (htmlFile: string) => {
  const doc = new DOMParser().parseFromString(Deno.readTextFileSync(htmlFile), "text/html")!
  const cssLines = doc.querySelector("style")!.innerText.split("\n")
  const indent = cssLines[cssLines.length - 1].length + 2
  return cssLines.slice(1, -1).map(l => l.substring(indent) + "\n").join("")
}

const process = (file: string) => {
  const path = file === "index.html" ? "home" : file.slice(0, -5)
  console.log(`Generating jsfiddle links for ${file}...`)
  const doc = new DOMParser().parseFromString(Deno.readTextFileSync(file), "text/html")!
  const {add, tags} = van.vanWithDoc(doc)
  const {a} = tags

  const vanVersion = Deno.readTextFileSync("code/van.version")
  const miniVanVersion = Deno.readTextFileSync("code/mini-van.version")

  for (const node of doc.querySelectorAll("[id^=jsfiddle-]")) {
    const dom = <Element>node
    if (dom.querySelector("a")) continue
    let code = findCode(dom)
    const replaceCode = dom.getAttribute("data-replace-code")
    if (replaceCode) code = replaceCode.replace("$CODE", code)
    const prefix = dom.getAttribute("data-prefix")
    if (prefix) code = prefix + "\n\n" + code
    const suffix = dom.getAttribute("data-suffix")
    if (suffix) code += "\n" + suffix + "\n"

    const subdir = join(path ? path : "home", dom.id.substring(9))
    const dir = join(jsFiddleRoot, subdir)
    mkdirIfNotExist(dir)
    const detailFile = dom.getAttribute("data-details") ?? "demo.details"
    const detailStr = Deno.readTextFileSync("jsfiddle/" + detailFile)
    Deno.writeTextFileSync(join(dir, "demo.details"),
      detailStr.replace("van-latest.",
        `van-${detailFile.includes("mini-van") ? miniVanVersion : vanVersion}.`))
    Deno.writeTextFileSync(join(dir, "demo.js"), code)
    const css = dom.getAttribute("data-css")
    if (css) Deno.writeTextFileSync(join(dir, "demo.css"), css)
    const cssFile = dom.getAttribute("data-css-file")
    if (cssFile) {
      if (cssFile.endsWith(".css"))
        Deno.copyFileSync(cssFile, join(dir, "demo.css")); else
        Deno.writeTextFileSync(join(dir, "demo.css"), extractCss(cssFile))
    }

    add(dom,
      a({href: "https://jsfiddle.net/gh/get/library/pure/" + join(ghPath, subdir)},
        "Try on jsfiddle",
      ),
    )
    for (const name of dom.getAttributeNames())
      if (name.startsWith("data-") || name === "id") dom.removeAttribute(name)
  }

  Deno.writeTextFileSync(file, "<!DOCTYPE html>\n" + doc.documentElement!.outerHTML)
}

for await (const f of Deno.readDir("."))
  if (f.isFile && f.name.endsWith(".html") && f.name !== "template.html") process(f.name)
