// Reference-counted scroll lock, so the intro and the mobile menu
// can't release each other's lock.
let count = 0
export function lockScroll() {
  count += 1
  document.body.classList.add('is-locked')
  return () => {
    count = Math.max(0, count - 1)
    if (count === 0) document.body.classList.remove('is-locked')
  }
}
