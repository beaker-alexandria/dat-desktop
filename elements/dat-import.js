'use strict'

const encoding = require('dat-encoding')
const icon = require('./icon')
const yo = require('choo/html')
const css = require('sheetify')

const prefix = css`
  :host {
    --icon-height: 1.2rem;
    color: var(--color-neutral-30);
    .icon-link {
      padding-top: .42rem;
      padding-left: .5rem;
      pointer-events: none;
      width: var(--icon-height);
      height: var(--icon-height);
    }
    input {
      height: 2rem;
      width: 7.25rem;
      padding-right: .5rem;
      padding-left: 2rem;
      font-size: .75rem;
      border: 1px solid transparent;
      background-color: transparent;
      color: var(--color-neutral-30);
      opacity: 1;
      text-transform: uppercase;
      letter-spacing: .025em;
      transition-property: width;
      transition-duration: .15s;
      transition-timing-function: ease-in;
      &::-webkit-input-placeholder {
        color: var(--color-neutral-30);
        opacity: 1;
      }
      &:hover,
      &:hover::-webkit-input-placeholder,
      &:hover + svg {
        color: var(--color-white);
      }
      &:focus,
      &:active {
        width: 14rem;
        outline: none;
        background-color: var(--color-white);
        color: var(--color-neutral);
      }
      &:focus::-webkit-input-placeholder,
      &:active::-webkit-input-placeholder,
      &:focus + svg,
      &:active + svg {
        color: var(--color-neutral-50);
      }
    }
  }
`

module.exports = (props) => {
  const keydown = (e) => {
    if (e.keyCode === 13) {
      const link = e.target.value
      try {
        encoding.decode(link)
      } catch (err) {
        throw new Error('Invalid link')
      }
      e.target.value = ''
      props.download(link)
    }
  }
  return yo`
    <label for="dat-import" class="relative dib pa0 b--none ${prefix}">
      <input name="dat-import" type="text" placeholder="Import dat" onkeydown=${keydown} class="input-reset">
      ${icon({
        id: 'link',
        cls: 'absolute top-0 bottom-0 left-0'
      })}
    </label>
  `
}