
/*
  Build-in tag library

    Why
      - Common, familiar syntax for content creators
      - No-need to re-implement the same thing accross websites
      - Radically reduces the amount of custom code
      - Shared semantics for design systems

    Features
      - Fully headless / semantic, minimal amount of class names
      - Fast, reliable, unit tested
      - Globally customizable
      - Can be combined to form more complex layouts
      - Outermost tag can change depending on use-case
      - Nuekit Error reporting
      - auto-detect attributes vs data
      - Usable outside Nuekit
      - Available on templates with "-tag" suffix: <image-tag>

*/

import { parseInline } from 'marked'
import { nuemarkdown } from '..'


export const tags = {

  // [button href="/kamaa" "Jotain"]
  button({ attr, href="#", label, _ }) {
    return elem('a', { ...attr, href, role: 'button' }, label || _)
  },

  icon({ _, icon_base='/img', alt }) {
    const src = `${icon_base}/${_}.svg`
    return elem('img', { src, alt: alt || `${_} icon` })
  },

  table({ attr, head, items=[] }) {
    const ths = toArray(head).map(val => elem('th', val))
    const thead = elem('thead', elem('tr', join(ths)))

    const trs = items.map(row => {
      const tds = toArray(row).map(val => elem('td', val))
      return elem('tr', join(tds))
    })

    return elem('table', attr, thead + elem('tbody', join(trs)))
  },

  section(data, opts) {
    const { content=[]} = data
    const bc = data.block_class || 'block'

    const divs = content.map((str, i) => {
      const html = nuemarkdown(str, opts)
      return content[1] ? elem('div', { class: `${bc} ${bc}-${i + 1}` }, html) : html
    })

    return elem('section', data.attr, join(divs))
  },

  /*
    # coderpad.io/blog/development/the-definitive-guide-to-responsive-images-on-the-web/

    * responsive: srcset, sizes
    * caption --> img -> <figure>
    * art direction: small, large, offset -> <picture>
    * href -> <a> wrapper
    * content -> tags.section()
  */
  image(data, opts) {
    const { attr, caption, width, href, content, loading='lazy' } = data

    const aside = caption ? elem('figcaption', parseInline(caption)) :
      content ? elem('figcaption', nuemarkdown(content[0], opts)) :
      null

    const img_attr = {
      src: data.src || data._ || data.large,
      srcset: join(data.srcset, ', '),
      sizes: join(data.sizes, ', '),
      alt: data.alt || caption,
      loading,
      width,
    }

    // img tag
    if (!aside) Object.assign(img_attr, attr)
    let img = data.small ? createPicture(img_attr, data) : elem('img', img_attr)

    // link
    if (href) img = elem('a', { href }, img)

    // figure
    return aside ? elem('figure', attr, img + aside) : img
  },


  // isomorphic later
  video(data, opts) {
    const { _, sources=[] } = data

    // inneer <source> tags
    const html = sources.map(src => elem('source', { src, type: getMimeType(src) }) )

    // fallback content
    const [md] = data.content || []
    if (md) html.push(nuemarkdown(md, opts))

    return elem('video', { ...data.attr, src: _, ...getVideoAttrs(data) }, join(html))
  },

  /*
    Use CSS :target selector
      1. [tabs] (split body blocks in two)
      2. [tabs "First, Second, Third"]
  */
  tabs(data, opts) {
    const { attr, name='tab', content=[], _ } = data
    const half = Math.round(content.length / 2)
    const t = _ || data.tabs
    const tabs_arr = t ? toArray(t) : content.slice(0, half)

    const tabs = tabs_arr.map((el, i) => {
      const html = t ? el : nuemarkdown(el, opts)
      return elem('a', { href: `#${name}-${i+1}` }, html )
    })

    const panes = content.slice(t ? 0 : half).map((el, i) => {
      const html = nuemarkdown(el, opts)
      return elem('li', { id: `${name}-${i+1}` }, html )
    })

    return elem('section', { is: 'nue-tabs', class: 'tabs', ...attr },
      elem('nav', join(tabs)) +
      elem('ul', join(panes))
    )
  },

  codetabs(data, opts) {
    const { content=[] } = data
    const types = toArray(data.types) || []

    // tabs are required
    if (!data._ && !data.tabs) throw 'codetabs: "tabs" attribute is required'

    // wrap content with fenced code blocks
    content.forEach((code, i) => {
      const type = types[i] || data.type || ''
      content[i] = join([('``` ' + type).trim(), code, '```'])
    })

    return tags.tabs(data, opts)
  },

}

// ! shortcut
tags['!'] = function(data, opts) {
  const mime = getMimeType(data._ || '')
  const tag = data.sources || mime?.startsWith('video') ? tags.video : tags.image
  return tag(data, opts)
}


export function elem(name, attr, body) {
  if (typeof attr == 'string') { body = attr; attr = {}}

  const html = [`<${name}${renderAttrs(attr)}>`]
  const closed = ['img', 'source'].includes(name)

  if (body) html.push(body)
  if (!closed) html.push(`</${name}>`)
  return html.join('')
}

function renderAttrs(attr) {
  const arr = []
  for (const key in attr) {
    const val = attr[key]
    if (val) arr.push(`${key}="${val}"`)
  }
  return arr[0] ? ' ' + arr.join(' ') : ''
}


function toArray(items) {
  return items?.split ? items.split(/ ?[,;|] ?/) : items
}

function join(els, separ='\n') {
  return els?.join ? els.join(separ) : els
}


export function createPicture(img_attr, data) {
  const { small, offset=768 } = data

  const sources = [small, img_attr.src].map(src => {
    const prefix = src == small ? 'max' : 'min'
    const media = `(${prefix}-width: ${offset}px)`
    return elem('source', { src, media, type: getMimeType(src) })
  })

  sources.push(elem('img', img_attr))
  return elem('picture', !data.caption && data.attr, join(sources))
}


function getVideoAttrs(data) {
  const keys = 'autoplay controls loop muted poster preload src width'.split(' ')
  const attr = {}
  for (const key of keys) {
    const val = data[key]
    if (val) attr[key] = val === true ? key : val
  }
  return attr
}

const MIME = {
  jpg: 'image/jpeg',
  svg: 'image/svg+xml',
  mov: 'video/mov',
  webm: 'video/webm',
  mp4: 'video/mp4',
}

function getMimeType(path) {
  const type = path.slice(path.lastIndexOf('.') + 1)
  return MIME[type] || `image/${type}`
}
