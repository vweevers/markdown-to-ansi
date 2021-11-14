import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmAutolinkLiteralFromMarkdown, gfmAutolinkLiteralToMarkdown } from 'mdast-util-gfm-autolink-literal'
import { toString } from 'mdast-util-to-string'
import { supportsHyperlink as sh } from 'supports-hyperlinks'
import ansiEscapes from 'ansi-escapes'
import stripAnsi from 'strip-ansi'
import chalk from 'chalk'
import normalizeUrl from 'normalize-url'

const defaultStyle = {
  inlineCode: chalk.cyan,
  heading: chalk.bold,
  emphasis: chalk.italic,
  strong: chalk.bold,
  thematicBreak: chalk.dim
}

export default function (options) {
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
    extensions: [gfmAutolinkLiteral],
    mdastExtensions: [gfmAutolinkLiteralFromMarkdown]
  }

  const stringifyOptions = {
    extensions: [gfmAutolinkLiteralToMarkdown],
    bullet: '-',
    listItemIndent: 'one',
    handlers: {
      inlineCode (node) {
        return style.inlineCode(safe(node.value))
      },
      link (node, parent, context) {
        if (!node.url) {
          return safe(toString(node))
        }

        if (!hyperlinks || !httpRe.test(node.url)) {
          return safe(node.url)
        }

        const label = autolink(node, context) ? shortUrl(node.url) : safe(toString(node))
        return ansiEscapes.link(label, node.url)
      },
      heading (node, parent, context) {
        const depth = Math.max(Math.min(6, node.depth || 1), 1)
        const prefix = '#'.repeat(depth)
        const value = safe(toString(node))

        return style.heading(value ? prefix + ' ' + value : prefix)
      },
      emphasis (node, parent, context) {
        return style.emphasis(safe(toString(node)))
      },
      strong (node, parent, context) {
        return style.strong(safe(toString(node)))
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

    return safe(normalizeUrl(url, { stripProtocol: true, stripWWW: true }))
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

function hasSingleChild (node, type) {
  return node.children &&
    node.children.length === 1 &&
    node.children[0].type === type
}

function safe (str) {
  return stripAnsi(String(str || ''))
}

// Adapted from `mdast-util-to-markdown`, MIT © Titus Wormer
function autolink (node, context) {
  return Boolean(
    // If there's a url and no title...
    (node.url && !node.title) &&
    // And the content of `node` is a single text node...
    hasSingleChild(node, 'text') &&
    // And the url is the same as the content...
    (node.url === node.children[0].value || node.url === 'mailto:' + node.children[0].value) &&
    // And that starts w/ a protocol...
    /^[a-z][a-z+.-]+:/i.test(node.url) &&
    // And that doesn't contain ASCII control codes (character escapes and
    // references don't work) or angle brackets...
    !/[\0- <>\u007F]/.test(node.url)
  )
}
