import EtaErr, { ParseErr } from './err'
import { trimWS } from './utils'

/* TYPES */

import { EtaConfig } from './config'

export type TagType = 'r' | 'e' | 'i' | ''

export interface TemplateObject {
  t: TagType
  val: string
}

export type AstObject = string | TemplateObject

/* END TYPES */

export default function parse (str: string, env: EtaConfig): Array<AstObject> {
  var buffer: Array<AstObject> = []
  var trimLeftOfNextStr: string | false = false
  var lastIndex = 0

  function pushString (strng: string, shouldTrimRightOfString?: string | false) {
    if (strng) {
      // if string is truthy it must be of type 'string'
      // replace \ with \\, ' with \'
      var stringToPush = strng.replace(/\\|'/g, '\\$&')

      // TODO: benchmark replace( /(\\|')/g, '\\$1')
      stringToPush = trimWS(
        stringToPush,
        env,
        trimLeftOfNextStr, // this will only be false on the first str, the next ones will be null or undefined
        shouldTrimRightOfString
      )

      stringToPush = stringToPush.replace(/\n/g, '\\n').replace(/\r/g, '\\r')

      if (stringToPush) {
        buffer.push(stringToPush)
      }
    }
  }

  var prefixes = (env.parse.exec + env.parse.interpolate + env.parse.raw).split('').join('|')

  var parseReg = new RegExp(
    '([^]*?)' +
      env.tags[0] +
      '(-|_)?\\s*(' +
      prefixes +
      ')?\\s*((?:[^]*?(?:\'(?:\\\\[\\s\\w"\'\\\\`]|[^\\n\\r\'\\\\])*?\'|`(?:\\\\[\\s\\w"\'\\\\`]|[^\\\\`])*?`|"(?:\\\\[\\s\\w"\'\\\\`]|[^\\n\\r"\\\\])*?"|\\/\\*[^]*?\\*\\/)?)*?)\\s*(-|_)?' +
      env.tags[1],
    'g'
  )

  // TODO: benchmark having the \s* on either side vs using str.trim()

  var m

  while ((m = parseReg.exec(str)) !== null) {
    lastIndex = m[0].length + m.index
    var i = m.index

    var precedingString = m[1]
    var wsLeft = m[2]
    var prefix = m[3] || '' // by default either ~, =, or empty
    var content = m[4]

    pushString(precedingString, wsLeft)
    trimLeftOfNextStr = m[5]

    var currentType: TagType = ''
    if (prefix === env.parse.exec) {
      currentType = 'e'
    } else if (prefix === env.parse.raw) {
      currentType = 'r'
    } else if (prefix === env.parse.interpolate) {
      currentType = 'i'
    }

    buffer.push({ t: currentType, val: content })
  }

  pushString(str.slice(lastIndex, str.length), false)

  if (env.plugins) {
    for (var i = 0; i < env.plugins.length; i++) {
      var plugin = env.plugins[i]
      if (plugin.processAST) {
        buffer = plugin.processAST(buffer, env)
      }
    }
  }

  return buffer
}