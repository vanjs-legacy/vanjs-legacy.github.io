import van from "/code/van-latest.min.js"

const {button, span} = van.tags

const Counter = () => {
  const counter = van.state(0)
  return span(
    "❤️ ", counter, " ",
    button({onclick: () => ++counter.val}, "👍"),
    button({onclick: () => --counter.val}, "👎"),
  )
}

van.add(document.getElementById("demo-counter"), Counter())
