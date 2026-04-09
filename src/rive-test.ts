import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RiveCharacter } from './rive-character'

gsap.registerPlugin(ScrollTrigger)

const canvas = document.getElementById('rive-canvas') as HTMLCanvasElement
const statusEl = document.getElementById('status') as HTMLElement
const inputsEl = document.getElementById('inputs-debug') as HTMLElement

function log(msg: string): void {
  statusEl.textContent = msg
  console.log(`[rive-test] ${msg}`)
}

log('Initializing Rive...')

const character = new RiveCharacter({
  canvas,
  src: '/rive/character-animation.riv',
  stateMachine: 'Alternatif',
  onLoad: (inputs) => {
    ;(window as any).__riveCharacter = character
    const names = [...inputs.keys()]
    log(`Loaded! Inputs: ${names.length ? names.join(', ') : '(none)'}`)
    inputsEl.textContent = names.length
      ? names.map((n) => {
          const inp = inputs.get(n)!
          return `${n} [${inp.type}] = ${inp.value}`
        }).join('\n')
      : 'No state machine inputs found.\nThe character will still play its default animation.'

    wireScrollTrigger()
  },
  onLoadError: (error) => {
    log(`Error: ${error}`)
    inputsEl.textContent = `Load failed: ${error}`
  },
  onStateChange: (states) => {
    log(`State → ${states.join(', ')}`)
  },
})

// Resize canvas to fill its container
function resize(): void {
  character.resizeToContainer()
}
resize()
window.addEventListener('resize', resize)

/**
 * Wire GSAP ScrollTrigger to Rive state machine inputs.
 *
 * The character-animation.riv uses the "Alternatif" state machine with
 * boolean inputs: IsIdle, IsWalking, IsRunning.
 *
 * Scroll sections:
 *  - Section 1 (0–33%): idle
 *  - Section 2 (33–66%): walking
 *  - Section 3 (66–100%): running (most energetic state available)
 */
function wireScrollTrigger(): void {
  const sections = document.querySelectorAll<HTMLElement>('.scroll-section')
  let lastSection = -1

  ScrollTrigger.create({
    trigger: '#scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const progress = self.progress // 0 → 1

      // Update progress bar
      const bar = document.getElementById('progress-bar')
      if (bar) bar.style.width = `${progress * 100}%`

      // Determine active section
      const section = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2
      updateActiveSection(sections, section)

      // Only update Rive inputs on section change to avoid constant toggling
      if (section !== lastSection) {
        lastSection = section

        if (section === 0) {
          character.setInput('IsIdle', true)
          character.setInput('IsWalking', false)
          character.setInput('IsRunning', false)
        } else if (section === 1) {
          character.setInput('IsIdle', false)
          character.setInput('IsWalking', true)
          character.setInput('IsRunning', false)
        } else {
          character.setInput('IsIdle', false)
          character.setInput('IsWalking', false)
          character.setInput('IsRunning', true)
        }
      }
    },
  })

  // Start in idle
  character.setInput('IsIdle', true)
  character.setInput('IsWalking', false)
  character.setInput('IsRunning', false)

  log('ScrollTrigger wired — scroll to interact')
}

function updateActiveSection(sections: NodeListOf<HTMLElement>, active: number): void {
  sections.forEach((el, i) => {
    el.classList.toggle('active', i === active)
  })
}
