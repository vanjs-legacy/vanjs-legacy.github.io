const quoteIfNeeded = key => /^[a-zA-Z_][a-zA-Z_0-9]+$/.test(key) ?
  key : `"${key}"`

const attrsToVanCode = dom => dom.attributes.length > 0 ?
  `{${[...dom.attributes].map(
    a => `${quoteIfNeeded(a.nodeName)}: ${JSON.stringify(a.nodeValue)}`)
    .join(", ")}}${dom.childNodes.length > 0 ? "," : ""}` : ""

const filterChild = (childNodes, {skipEmptyText}) =>
  [...childNodes].filter(c => (c.nodeType === 1 || c.nodeType === 3) &&
    (!skipEmptyText || c.nodeName !== "#text" || /\S/.test(c.nodeValue)))

const autoGrow = e => {
  e.style.height = "5px"
  e.style.height = (e.scrollHeight + 5) + "px"
}

const domToVanCode = (dom,
  {indent = 0, indentLevel, skipEmptyText, skipTrailingComma},
  tagsUsed) => {
  const prefix = " ".repeat(indent)
  const suffix = skipTrailingComma ? "" : ","
  if (dom.nodeName === "#text")
    return [`${prefix}${JSON.stringify(dom.nodeValue)}${suffix}`]
  const lowerCaseTagName = dom.nodeName.toLowerCase()
  tagsUsed.add(lowerCaseTagName)
  if (lowerCaseTagName === "pre") skipEmptyText = false
  return dom.childNodes.length > 0 ? [
    `${prefix}${lowerCaseTagName}(${attrsToVanCode(dom)}`,
    ...filterChild(dom.childNodes, {skipEmptyText}).flatMap(c =>
      domToVanCode(
        c, {indent: indent + indentLevel, indentLevel, skipEmptyText},
        tagsUsed)),
    `${prefix})${suffix}`,
  ] : [
    `${prefix}${lowerCaseTagName}(${attrsToVanCode(dom)})${suffix}`,
  ]
}

const Converter = ({initInput}) => {
  const oninput = () => {
    autoGrow(textareaDom)
    const containerDom = div()
    containerDom.innerHTML = textareaDom.value
    const tagsUsed = new Set;
    const childNodes = filterChild(containerDom.childNodes,
      {skipEmptyText: skipEmptyTextDom.checked})
    const lines = childNodes.flatMap(c =>
      domToVanCode(c, {
        indentLevel: parseInt(indentInputDom.value),
        skipEmptyText: skipEmptyTextDom.checked,
        skipTrailingComma: childNodes.length <= 1
      }, tagsUsed))
    const sortedTags = [...tagsUsed].sort()
    tagsCode.val = `const {${sortedTags.join(", ")}} = van.tags`
    domCode.val = lines.join("\n")
    setTimeout(() => Prism.highlightAll(), 5)
  }

  const textareaDom = textarea({oninput, style: "width: 100%;"}, initInput)
  const indentInputDom = input(
    {type: "number", min: 1, max: 8, value: 2, oninput})
  const skipEmptyTextDom = input({type: "checkbox", oninput})
  const tagsCode = van.state(""), domCode = van.state("")

  // Trigger the UI update after initialization
  setTimeout(() => textareaDom.dispatchEvent(new Event("input")))
  return div(
    h5("Paste your HTML snippet here:"),
    textareaDom,
    "Indent level: ", indentInputDom, " ",
    skipEmptyTextDom, "Skip empty text",
    h5("Declaring tag functions:"),
    van.bind(tagsCode, c => div(pre(code({class: "language-js"}, c)))),
    h5("Building the DOM tree:"),
    van.bind(domCode, c => div(pre(code({class: "language-js"}, c)))),
  )
}
