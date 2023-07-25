/* TYPES */

import type { Options } from "./config.ts";
import type { AstObject } from "./parse.ts";
import type { Eta } from "./core.ts";

/* END TYPES */

/**
 * Compiles a template string to a function string. Most often users just use `compile()`, which calls `compileToString` and creates a new function using the result
 */

export function compileToString(this: Eta, str: string, options?: Partial<Options>): string {
  const config = this.config;
  const isAsync = options && options.async;

  const buffer: Array<AstObject> = this.parse.call(this, str);

  // note: when the include function passes through options, the only parameter that matters is the filepath parameter
  let res = `${config.functionHeader}
let include = (template, data) => this.render(template, data, options);
let includeAsync = (template, data) => this.renderAsync(template, data, options);

let __eta = {res: "", e: this.config.escapeFunction, f: this.config.filterFunction${
    config.debug
      ? ', line: 1, templateStr: "' +
        str.replace(/\\|'/g, "\\$&").replace(/\r\n|\n|\r/g, "\\n") +
        '"'
      : ""
  }};

function layout(path, data) {
  __eta.layout = path;
  __eta.layoutData = data;
}${config.debug ? "try {" : ""}${config.useWith ? "with(" + config.varName + "||{}){" : ""}

${this.compileBody.call(this, buffer)}
if (__eta.layout) {
  __eta.res = ${isAsync ? "await includeAsync" : "include"} (__eta.layout, {...${
    config.varName
  }, body: __eta.res, ...__eta.layoutData});
}
${config.useWith ? "}" : ""}${
    config.debug
      ? "} catch (e) { this.RuntimeErr(e, __eta.templateStr, __eta.line, options.filepath) }"
      : ""
  }
return __eta.res;
`;

  if (config.plugins) {
    for (let i = 0; i < config.plugins.length; i++) {
      const plugin = config.plugins[i];
      if (plugin.processFnString) {
        res = plugin.processFnString(res, config);
      }
    }
  }

  return res;
}

/**
 * Loops through the AST generated by `parse` and transform each item into JS calls
 *
 * **Example**
 *
 * ```js
 * let templateAST = ['Hi ', { val: 'it.name', t: 'i' }]
 * compileBody.call(Eta, templateAST)
 * // => "__eta.res+='Hi '\n__eta.res+=__eta.e(it.name)\n"
 * ```
 */

function compileBody(this: Eta, buff: Array<AstObject>) {
  const config = this.config;

  let i = 0;
  const buffLength = buff.length;
  let returnStr = "";

  for (i; i < buffLength; i++) {
    const currentBlock = buff[i];
    if (typeof currentBlock === "string") {
      const str = currentBlock;

      // we know string exists
      returnStr += "__eta.res+='" + str + "'\n";
    } else {
      const type = currentBlock.t; // "r", "e", or "i"
      let content = currentBlock.val || "";

      if (config.debug) returnStr += "__eta.line=" + currentBlock.lineNo + "\n";

      if (type === "r") {
        // raw

        if (config.autoFilter) {
          content = "__eta.f(" + content + ")";
        }

        returnStr += "__eta.res+=" + content + "\n";
      } else if (type === "i") {
        // interpolate

        if (config.autoFilter) {
          content = "__eta.f(" + content + ")";
        }

        if (config.autoEscape) {
          content = "__eta.e(" + content + ")";
        }

        returnStr += "__eta.res+=" + content + "\n";
      } else if (type === "e") {
        // execute
        returnStr += content + "\n";
      }
    }
  }

  return returnStr;
}
