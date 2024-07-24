declare const main: HTMLElement
declare const sounds: HTMLElement
declare const bpm: HTMLInputElement
declare const add: HTMLButtonElement

const DEBUG = false
let sndIndex = 0

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const outs = Object.fromEntries([...ALPHABET].map(x => [x, 0])) as Record<string, [Float32Array, Float32Array] | 0>

function Sound() {
  const index = sndIndex++
  const id = ALPHABET[index]
  const PI2 = Math.PI * 2
  const L = 0
  const R = 1

  //#region create elements
  const row = document.createElement('div')
  row.className = 'row'
  sounds.append(row)

  const label = document.createElement('label')
  label.textContent = id
  row.append(label)

  const bars = document.createElement('input')
  bars.value = localStorage.getItem('bars' + index) || '1'
  bars.type = 'number'
  bars.step = '1'
  bars.style.width = '2em'
  row.append(bars)

  const input = document.createElement('input')
  input.value = localStorage.getItem('snd' + index) || 'sin(1)'
  input.spellcheck = false
  input.style.width = '100%'
  row.append(input)

  const play = document.createElement('button')
  const Play = '🞂' //'▶️'
  const Stop = '⏹️'
  play.textContent = Play
  play.style.cursor = 'pointer'
  play.style.background =
    play.style.border = 'none'

  let source: AudioBufferSourceNode
  play.onclick = () => {
    play.textContent = play.textContent === Stop ? Play : Stop
    if (play.textContent === Stop) {
      const buffer = audio.createBuffer(2, g.size, g.sr)
      buffer.getChannelData(L).set(out[L])
      buffer.getChannelData(R).set(out[R])
      source = audio.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(audio.destination)
      source.start()
    }
    else {
      source.stop()
    }
  }
  row.append(play)

  const canvas = document.createElement('canvas')
  const [width, height, pr] = [window.innerWidth - 20, window.innerHeight / 16, window.devicePixelRatio]
  canvas.width = width * pr
  canvas.height = height * pr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  const c = canvas.getContext('2d')
  c.scale(pr, pr)
  c.lineWidth = 0.125
  c.lineCap = 'round'
  c.lineJoin = 'round'
  sounds.appendChild(canvas)
  //#endregion

  let chunk = 0

  const g = {
    /** sample position */
    n: 0,
    /** sample rate */
    sr: 48000,
    /** control rate */
    cr: 1,
    /** tempo coefficient */
    co: 1,
    /** buffer size */
    size: 48000 * bars.valueAsNumber,

    mod: Infinity,
    ...Object.fromEntries([...ALPHABET].map(x => [x, { L: 0, R: 0 }])),

    sin(hz: number) {
      for (let i = g.n, t: number; i < chunk; i++) {
        t = (i / g.sr) % g.mod
        out[L][i] = Math.sin(t * hz * PI2)
      }
    },

    mul(x: number) {
      for (let i = g.n, t: number; i < chunk; i++) {
        out[L][i] *= x
      }
    },

    fill(x: number) {
      for (let i = g.n, t: number; i < chunk; i++) {
        out[L][i] = x
      }
    },

    exp(amt: number) {
      for (let i = g.n, t: number; i < chunk; i++) {
        t = (i / g.sr) % (g.mod * g.co)
        out[L][i] = out[L][i] * Math.exp(-t * amt * 2)
      }
    },
  }

  const audio = new AudioContext({ sampleRate: g.sr })

  let out: [Float32Array, Float32Array]

  function createOut() {
    g.co = bpm.valueAsNumber / 60
    g.size = g.sr * g.co * bars.valueAsNumber
    out = outs[index] = [
      new Float32Array(g.size),
      new Float32Array(g.size),
    ]
  }
  createOut()
  bars.oninput = bpm.oninput = () => { createOut(); process() }

  function draw() {
    const HH = height / 2
    const hh = HH - c.lineWidth * 2

    c.clearRect(0, 0, width, height)
    c.beginPath()
    c.moveTo(0, HH)
    c.lineTo(width, HH)
    c.strokeStyle = '#444'
    c.stroke()

    c.beginPath()
    c.moveTo(0, HH)
    c.lineTo(0, HH - out[L][0] * hh)
    const wco = 1
    const coeff = out[L].length / width / wco
    for (let x = 1; x < width; x += 1 / 14) {
      const f = out[L][(x * coeff) | 0]
      c.lineTo(x, HH - f * hh)
    }
    c.fillStyle = '#ccc'
    c.strokeStyle = '#ccc'
    c.globalCompositeOperation =
      'source-over'
    // 'screen'
    // 'destination-over'
    c.fill()
    c.stroke()
  }

  function popOuts(x: number) {
    for (let i = 0; i < sndIndex; i++) {
      g[ALPHABET[i]].L = outs[i][L][x % outs[i][L].length]
      g[ALPHABET[i]].R = outs[i][R][x % outs[i][R].length]
    }
  }

  function process() {
    out[L].fill(0)
    out[R].fill(0)
    g.n = 0
    const chunkSize = g.cr
    const fn = new Function(...Object.keys(g), input.value)
    try {
      // @ts-ignore
      with (g) {
        while (g.n < g.size) {
          g.mod = Infinity
          popOuts(g.n)
          chunk = g.n + chunkSize
          fn(...Object.values(g))
          g.n += chunkSize
        }
      }
      localStorage.setItem('snd' + index, input.value)
      localStorage.setItem('bars' + index, bars.value)
      draw()
    }
    catch (e) {
      console.error(e)
    }
  }

  process()
  input.oninput = process

  localStorage.count = sndIndex
}

const count = +localStorage.count || 1
for (let i = 0; i < count; i++) {
  Sound()
}

add.onclick = () => Sound()
