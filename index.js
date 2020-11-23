'use strict'

const fromMarkdown = require('mdast-util-from-markdown')
const toMarkdown = require('mdast-util-to-markdown')
const syntax = require('micromark-extension-gfm-autolink-literal')
const autolinkLiteral = require('mdast-util-gfm-autolink-literal')
const sh = require('supports-hyperlinks').supportsHyperlink
const ansiEscapes = require('ansi-escapes')
const stripAnsi = require('strip-ansi')
const chalk = require('chalk')
const normalizeUrl = require('normalize-url')

// TODO: avoid internals
const isAutolink = require('mdast-util-to-markdown/lib/util/format-link-as-autolink')
const phrasing = require('mdast-util-to-markdown/lib/util/container-phrasing')
const defaultHandlers = require('mdast-util-to-markdown/lib/handle')

const defaultStyle = {
  inlineCode: chalk.cyan,
  heading: chalk.bold,
  emphasis: chalk.italic,
  strong: chalk.bold,
  thematicBreak: chalk.dim
}

module.exports = function (options) {
  options = options || {}

  const style = { ...defaultStyle, ...options.style }
  const stream = options.stream || process.stdout
  const width = options.width || stream.columns || 3
  const hyperlinks = supportsHyperlinks(stream)

  const httpRe = /^https?:\/\//
  const npmRe = /^https?:\/\/(?:www\.)?npmjs\.com\/package\/([a-z0-9-_@!.]{1,214})$/i

  // Copied from `remark-github`, MIT © Titus Wormer
  const ghRefRe = /^https?:\/\/github\.com\/([\da-z][-\da-z]{0,38})\/((?:\.git[\w-]|\.(?!git)|[\w-])+)\/(commit|issues|pull)\/([a-f\d]+\/?(?=[#?]|$))/i
  const ghRepoRe = /^https?:\/\/github\.com\/([\da-z][-\da-z]{0,38})\/((?:\.git[\w-]|\.(?!git)|[\w-])+)/i

  const parserOptions = {
    extensions: [syntax],
    mdastExtensions: [autolinkLiteral.fromMarkdown]
  }

  const stringifyOptions = {
    extensions: [autolinkLiteral.toMarkdown],
    bullet: '-',
    listItemIndent: 'one',
    handlers: {
      inlineCode (node) {
        return style.inlineCode(node.value || '')
      },
      link (node, parent, context) {
        if (!node.url) {
          return defaultHandlers.link(node, parent, context)
        }

        if (!hyperlinks || !httpRe.test(node.url)) {
          return node.url
        }

        const exit = context.enter('link')
        const label = isAutolink(node) ? shortUrl(node.url) : phrasing(node, context, {})

        exit()

        return ansiEscapes.link(label, node.url)
      },
      heading (node, parent, context) {
        return style.heading(defaultHandlers.heading(node, parent, context))
      },
      emphasis (node, parent, context) {
        const exit = context.enter('emphasis')
        const value = phrasing(node, context, {})

        exit()

        return style.emphasis(value)
      },
      strong (node, parent, context) {
        const exit = context.enter('strong')
        const value = phrasing(node, context, {})

        exit()

        return style.strong(value)
      },
      thematicBreak (node, parent, context) {
        return style.thematicBreak('—'.repeat(width))
      }
    }
  }

  return transform

  function transform (markdown) {
    const plain = stripAnsi(markdown)
    const tree = fromMarkdown(plain, parserOptions)

    return toMarkdown(tree, stringifyOptions).trim()
  }

  function shortUrl (url) {
    let match = ghRefRe.exec(url)

    if (match) {
      const owner = match[1]
      const name = match[2]
      const sep = match[3] === 'commit' ? '@' : '#'
      const ref = match[4]

      return `${owner}/${name}${sep}${ref}`
    }

    match = ghRepoRe.exec(url)

    if (match) {
      const owner = match[1]
      const name = match[2]

      return style.inlineCode(`${owner}/${name}`)
    }

    match = npmRe.exec(url)

    if (match) {
      const packageName = match[1]
      return style.inlineCode(packageName)
    }

    return normalizeUrl(url, { stripProtocol: true, stripWWW: true })
  }
}

function supportsHyperlinks (stream) {
  if (process.env.FORCE_HYPERLINK === '0') {
    return false
  }

  if (process.env.FORCE_HYPERLINK === '1') {
    return true
  }

  if (!stream.isTTY) {
    return false
  }

  return sh(stream) || isWindowsTerminal()
}

function isWindowsTerminal () {
  return !!process.env.WT_SESSION
}
