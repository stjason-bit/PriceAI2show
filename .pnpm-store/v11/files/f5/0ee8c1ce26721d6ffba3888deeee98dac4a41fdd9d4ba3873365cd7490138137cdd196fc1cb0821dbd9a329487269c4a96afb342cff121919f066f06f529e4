"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  _runtime: () => _runtime,
  createMDXSource: () => createMDXSource,
  resolveFiles: () => resolveFiles
});
module.exports = __toCommonJS(index_exports);

// src/runtime/index.ts
var import_node_fs = __toESM(require("fs"), 1);
var cache = /* @__PURE__ */ new Map();
var _runtime = {
  doc(files) {
    return files.map((file) => {
      const { default: body, frontmatter, ...exports2 } = file.data;
      return {
        body,
        ...exports2,
        ...frontmatter,
        _file: file.info,
        _exports: file.data,
        get content() {
          const path = this._file.absolutePath;
          const cached = cache.get(path);
          if (cached) return cached;
          const content = import_node_fs.default.readFileSync(path).toString();
          cache.set(path, content);
          return content;
        }
      };
    });
  },
  meta(files) {
    return files.map((file) => {
      return {
        ...file.data,
        _file: file.info
      };
    });
  },
  docs(docs, metas) {
    const parsedDocs = this.doc(docs);
    const parsedMetas = this.meta(metas);
    return {
      docs: parsedDocs,
      meta: parsedMetas,
      toFumadocsSource() {
        return createMDXSource(parsedDocs, parsedMetas);
      }
    };
  }
};
function createMDXSource(docs, meta = []) {
  return {
    files: () => resolveFiles({
      docs,
      meta
    })
  };
}
function resolveFiles({ docs, meta }) {
  const outputs = [];
  for (const entry of docs) {
    outputs.push({
      type: "page",
      absolutePath: entry._file.absolutePath,
      path: entry._file.path,
      data: entry
    });
  }
  for (const entry of meta) {
    outputs.push({
      type: "meta",
      absolutePath: entry._file.absolutePath,
      path: entry._file.path,
      data: entry
    });
  }
  return outputs;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  _runtime,
  createMDXSource,
  resolveFiles
});
