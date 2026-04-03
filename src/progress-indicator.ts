// ─── Progress Indicator ─────────────────────────────────────────────────────

export interface ProgressIndicator {
  update(activeIndex: number, sceneCount: number): void
  destroy(): void
}

export function initProgressIndicator(container: HTMLElement): ProgressIndicator {
  const dots: HTMLElement[] = []
  let currentCount = 0

  function ensureDots(count: number): void {
    if (count === currentCount) return

    // Clear existing
    container.innerHTML = ''
    dots.length = 0

    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div')
      dot.className = 'progress-dot'
      container.appendChild(dot)
      dots.push(dot)
    }
    currentCount = count
  }

  return {
    update(activeIndex: number, sceneCount: number): void {
      ensureDots(sceneCount)
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === activeIndex)
      }
    },
    destroy(): void {
      container.innerHTML = ''
      dots.length = 0
    },
  }
}
