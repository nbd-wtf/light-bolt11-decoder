import { decode } from '../bolt11.js'

const TAGCOLORS = {
  lightning_network: 'rgb(31, 31, 40)',
  coin_network: 'rgb(27, 51, 93)',
  amount: 'rgb(0, 110, 98)',
  separator: 'rgb(31, 31, 40)',
  timestamp: 'rgb(181, 10, 11)',
  payment_hash: 'rgb(71, 105, 169)',
  description: 'rgb(41, 131, 11)',
  description_hash: 'rgb(41, 131, 11)',
  payment_secret: 'rgb(92, 25, 75)',
  expiry: 'rgb(181, 10, 11)',
  metadata: 'rgb(86, 25, 24)',
  feature_bits: 'rgb(57, 118, 179)',
  payee: 'rgb(51, 44, 138)',
  unknown_tag: 'rgb(37, 15, 45)',
  min_final_cltv_expiry: 'rgb(119, 34, 32)',
  fallback_address: 'rgb(27, 51, 93)',
  route_hint: 'rgb(131, 93, 233)',
  signature: 'rgb(51, 44, 138)',
  checksum: 'rgb(31, 31, 40)'
}

function getTagColor(name) {
  return TAGCOLORS[name] || 'rgb(0, 0, 0)'
}

function start() {
  const pr =
    'lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567'
  const textInputTextarea = document.querySelector('#textInput')
  textInputTextarea.value = pr
  textInputTextarea.addEventListener('change', () => {
    setPR(textInputTextarea.value)
    console.log('changed')
  })
  setPR(pr)
}

function setColor(element, sectionName) {
  element.style.color = 'black'
  element.style.backgroundColor = getTagColor(sectionName).replace('rgb', 'rgba').replace(')', ', 0.2)')
}

function setHighlight(element, sectionName) {
  element.style.color = 'white'
  element.style.backgroundColor = getTagColor(sectionName)
}

function newSpan(section) {
  const sectionSpan = document.createElement('span')
  sectionSpan.textContent = section.letters
  sectionSpan.style.fontFamily = 'monospace'
  sectionSpan.style.fontSize = '25px'
  setColor(sectionSpan, section.name)
  sectionSpan.addEventListener('mouseenter', () => {
    setHighlight(sectionSpan, section.name)
    setInfo(section)
  })
  sectionSpan.addEventListener('mouseleave', () => {
    setColor(sectionSpan, section.name)
    clearInfo()
  })
  return sectionSpan
}

function setInfo(section) {
  const infoDiv = document.querySelector('#info')
  infoDiv.innerHTML = ''
  infoDiv.style.backgroundColor = getTagColor(section.name)
  infoDiv.style.display = 'block'
  const name = document.createElement('div')
  name.textContent = `name: ${section.name}`

  infoDiv.append(name)
  if (section.tag) {
    const tag = document.createElement('div')
    tag.textContent = `tag: ${section.tag}`
    infoDiv.append(tag)
  }
  const tag = document.createElement('div')
  tag.textContent = `tag: ${JSON.stringify(section.value)}`
  infoDiv.append(tag)
}

function clearInfo() {
  const infoDiv = document.querySelector('#info')
  infoDiv.style.display = 'none'
}

function setPR(pr) {
  const parsed = decode(pr)
  const decodedDiv = document.querySelector('#decoded')
  decodedDiv.innerHTML = ''
  for (const section of parsed.sections) decodedDiv.append(newSpan(section))
}

export { start, setPR }
