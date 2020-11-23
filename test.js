'use strict'

const test = require('tape')
const fs = require('fs')
const toAnsi = require('.')

test('with hyperlinks', function (t) {
  enableHyperlinks(true)
  t.plan(2)

  const transform = toAnsi({ width: 69 })
  const markdown = fs.readFileSync('example/index.md', 'utf8')
  const expected = fs.readFileSync('fixture/with-hyperlinks', 'utf8')

  for (let i = 0; i < 2; i++) {
    t.is(transform(markdown), expected)
  }
})

test('without hyperlinks', function (t) {
  enableHyperlinks(false)
  t.plan(2)

  const transform = toAnsi({ width: 69 })
  const markdown = fs.readFileSync('example/index.md', 'utf8')
  const expected = fs.readFileSync('fixture/without-hyperlinks', 'utf8')

  for (let i = 0; i < 2; i++) {
    t.is(transform(markdown), expected)
  }
})

function enableHyperlinks (bool) {
  process.env.FORCE_HYPERLINK = bool ? '1' : '0'
}
