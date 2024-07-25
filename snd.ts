declare const main: HTMLElement
declare const sounds: HTMLElement
declare const bpm: HTMLInputElement
declare const add: HTMLButtonElement

const DEBUG = false
let sndIndex = 0

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const outs = Object.fromEntries([...ALPHABET].map(x => [x, 0])) as Record<string, [Float32Array, Float32Array] | 0>

const SAMPLE_RATE = 48000
const audio = new AudioContext({ sampleRate: SAMPLE_RATE })

const Sounds = []

// initialize if empty
if (!localStorage.snd0) {
  localStorage.snd0 = `mod(1/4);set(1);exp(12);mul(.8);`
  localStorage.snd1 = `mod(1/4);set(1);exp(13);`
  localStorage.snd2 = `mod(1/4);sin((B.L*180)+55,1.29);mul(A.L);`
  localStorage.bars0 = '0.25'
  localStorage.bars1 = '0.25'
  localStorage.bars2 = '1'
  localStorage.count = '3'
}

function Sound() {
  const index = sndIndex++
  const id = ALPHABET[index]
  const pi2 = Math.PI * 2
  const L = 0
  const R = 1

  //#region create elements
  const row = document.createElement('div')
  row.className = 'row'
  sounds.append(row)

  const label = document.createElement('label')
  label.textContent = id
  row.append(label)

  const input = document.createElement('input')
  input.value = localStorage.getItem('snd' + index) || 'sin(1)'
  input.spellcheck = false
  input.style.width = '100%'
  row.append(input)

  const bars = document.createElement('input')
  bars.value = localStorage.getItem('bars' + index) || '1'
  bars.type = 'number'
  bars.step = '.25'
  bars.min = '.25'
  bars.style.width = '3em'
  row.append(bars)

  const play = document.createElement('button')
  const Play = '🞂' //'▶️'
  const Stop = '⏹️'
  play.textContent = Play
  play.style.cursor = 'pointer'
  play.style.background =
    play.style.border = 'none'

  let source: AudioBufferSourceNode
  let buffer: AudioBuffer
  function updateBuffer() {
    buffer?.getChannelData(L).set(out[L])
    buffer?.getChannelData(R).set(out[R])
  }
  play.onclick = () => {
    play.textContent = play.textContent === Stop ? Play : Stop
    if (play.textContent === Stop) {
      buffer = audio.createBuffer(2, g.size, g.sr)
      updateBuffer()
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

  const g = {
    /** sample position */
    n: 0,
    /** sample rate */
    sr: 48000,
    /** tempo coefficient */
    co: 1,
    /** buffer size */
    size: 48000 * bars.valueAsNumber,
    /** real time */
    rt: 0,
    /** bar time */
    bt: 0,

    pi2,

    _mod: Infinity,

    ...Object.fromEntries([...ALPHABET].map(x => [x, { L: 0, R: 0 }])),

    mod(x: number) {
      g._mod = x
      const t = g.n / g.sr
      g.rt = t % g._mod
      g.bt = t % (g._mod * g.co)
    },

    sin(hz: number, phase: number = 0) {
      out[L][g.n] =
        out[R][g.n] =
        Math.sin(g.bt * hz * pi2 + phase)
    },

    mul(x: number) {
      out[L][g.n] *= x
      out[R][g.n] *= x
    },

    set(x: number) {
      out[L][g.n] = x
      out[R][g.n] = x
    },

    exp(amt: number) {
      out[L][g.n] *= Math.exp(-g.bt * amt * 2)
      out[R][g.n] *= Math.exp(-g.bt * amt * 2)
    },

    pow(amt: number) {
      out[L][g.n] **= amt
      out[R][g.n] **= amt
    },
  }

  let out: [Float32Array, Float32Array]

  function createOut() {
    g.co = 60 / bpm.valueAsNumber * 4
    g.size = g.sr * g.co * bars.valueAsNumber
    out = outs[ALPHABET[index]] = [
      new Float32Array(g.size),
      new Float32Array(g.size),
    ]
  }
  createOut()
  bars.oninput = () => { createOut(); process(); updateBuffer() }
  bpm.addEventListener('input', bars.oninput)

  function popOuts(n: number) {
    for (let i = 0; i < sndIndex; i++) {
      const x = ALPHABET[i]
      g[x].L = outs[x][L][n % outs[x][L].length]
      g[x].R = outs[x][R][n % outs[x][R].length]
    }
  }

  function process() {
    out[L].fill(0)
    out[R].fill(0)
    g.n = 0
    try {
      const fn = new Function(...Object.keys(g), `
        mod(Infinity);
        ${input.value}
      `)
      for (g.n = 0; g.n < g.size; g.n++) {
        popOuts(g.n)
        fn(...Object.values(g))
      }
      localStorage.setItem('snd' + index, input.value)
      localStorage.setItem('bars' + index, bars.value)
      draw()
    }
    catch (e) {
      console.error(e)
    }
  }

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

  process()
  input.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      process()
      updateBuffer()
      for (const sound of Sounds) {
        if (sound.input.value.includes(ALPHABET[index] + '.L')
          || sound.input.value.includes(ALPHABET[index] + '.R')) {
          sound.process()
          sound.updateBuffer()
        }
      }
    }
  }

  localStorage.count = sndIndex

  return {
    input,
    process,
    updateBuffer,
  }
}

const count = +localStorage.count || 1
for (let i = 0; i < count; i++) {
  Sounds.push(Sound())
}

add.onclick = () => Sounds.push(Sound())
