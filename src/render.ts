import { EtaError } from "./err.ts";

/* TYPES */
import type { Options } from "./config.ts";
import type { TemplateFunction } from "./compile.ts";
import type { Eta } from "./core.ts";
/* END TYPES */

function handleCache(this: Eta, template: string, options: Partial<Options>): TemplateFunction {
  const templateStore = options && options.async ? this.templatesAsync : this.templatesSync;

  if (this.resolvePath && this.readFile && !template.startsWith("@")) {
    const templatePath = options.filepath as string;

    const cachedTemplate = templateStore.get(templatePath);

    if (this.config.cache && cachedTemplate) {
      return cachedTemplate;
    } else {
      const templateString = this.readFile(templatePath);

      const templateFn = this.compile(templateString, options);

      if (this.config.cache) templateStore.define(templatePath, templateFn);

      return templateFn;
    }
  } else {
    const cachedTemplate = templateStore.get(template);

    if (cachedTemplate) {
      return cachedTemplate;
    } else {
      throw new EtaError("Failed to get template '" + template + "'");
    }
  }
}

export function render(
  this: Eta,
  template: string | TemplateFunction, // template name or template function
  data: object,
  meta?: { filepath: string }
): string {
  let templateFn: TemplateFunction;
  const options = { ...meta, async: false };

  if (typeof template === "string") {
    if (this.resolvePath && this.readFile && !template.startsWith("@")) {
      options.filepath = this.resolvePath(template, options);
    }

    templateFn = handleCache.call(this, template, options);
  } else {
    templateFn = template;
  }

  const res = templateFn.call(this, data, options);

  return res;
}

export function renderAsync(
  this: Eta,
  template: string | TemplateFunction, // template name or template function
  data: object,
  meta?: { filepath: string }
): Promise<string> {
  let templateFn: TemplateFunction;
  const options = { ...meta, async: true };

  if (typeof template === "string") {
    if (this.resolvePath && this.readFile && !template.startsWith("@")) {
      options.filepath = this.resolvePath(template, options);
    }

    templateFn = handleCache.call(this, template, options);
  } else {
    templateFn = template;
  }

  const res = templateFn.call(this, data, options);

  // Return a promise
  return Promise.resolve(res);
}

export function renderString(this: Eta, template: string, data: object): string {
  const templateFn = this.compile(template, { async: false });

  return render.call(this, templateFn, data);
}

export function renderStringAsync(this: Eta, template: string, data: object): Promise<string> {
  const templateFn = this.compile(template, { async: true });

  return renderAsync.call(this, templateFn, data);
}
