// src/runtime/index.ts
import fs from "fs";
var cache = /* @__PURE__ */ new Map();
var _runtime = {
  doc(files) {
    return files.map((file) => {
      const { default: body, frontmatter, ...exports } = file.data;
      return {
        body,
        ...exports,
        ...frontmatter,
        _file: file.info,
        _exports: file.data,
        get content() {
          const path = this._file.absolutePath;
          const cached = cache.get(path);
          if (cached) return cached;
          const content = fs.readFileSync(path).toString();
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

export {
  _runtime,
  createMDXSource,
  resolveFiles
};
