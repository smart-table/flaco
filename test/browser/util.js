export function waitNextTick () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, 2)
  })
}